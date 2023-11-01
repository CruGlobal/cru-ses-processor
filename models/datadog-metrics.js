import dogapi from 'dogapi'
import get from 'lodash/get'
import has from 'lodash/has'
import toLower from 'lodash/toLower'
import identity from 'lodash/identity'
import truncate from 'lodash/truncate'
import compact from 'lodash/compact'
import { BOUNCE_TYPE, COMPLAINT_TYPE, DELIVERY_TYPE } from './ses-message'

const BOUNCE_METRIC = 'cru.ses.bounce'
const COMPLAINT_METRIC = 'cru.ses.complaint'
const DELIVERY_METRIC = 'cru.ses.delivery'

class DataDogMetrics {
  constructor (sesMessage) {
    this.sesMessage = sesMessage
    dogapi.initialize({
      api_key: process.env.DATADOG_API_KEY,
      app_key: process.env.DATADOG_APP_KEY
    })
  }

  get message () {
    return this.sesMessage.message
  }

  send () {
    return new Promise((resolve, reject) => {
      const metrics = this.recipientEmails().map(emailAddress => ({
        metric: this.metric(),
        points: [[this.timestamp(), 1]],
        metric_type: 'count',
        tags: compact([
          this.sourceArnTag(),
          this.senderTag(),
          this.callerIdentityTag(),
          this.recipientTag(emailAddress),
          this.subjectTag(),
          this.bounceTypeTag(),
          this.bounceSubTypeTag(),
          this.complaintTypeTag()
        ])
      }))

      dogapi.metric.send_all(metrics, (err, results) => {
        if (err) {
          reject(err)
        } else {
          resolve(results)
        }
      })
    })
  }

  recipientEmails () {
    switch (this.sesMessage.notificationType) {
      case BOUNCE_TYPE:
        return get(this.message, 'bounce.bouncedRecipients').map(val => val.emailAddress)
      case COMPLAINT_TYPE:
        return get(this.message, 'complaint.complainedRecipients').map(val => val.emailAddress)
      case DELIVERY_TYPE:
        return get(this.message, 'delivery.recipients')
    }
  }

  metric () {
    switch (this.sesMessage.notificationType) {
      case BOUNCE_TYPE:
        return BOUNCE_METRIC
      case COMPLAINT_TYPE:
        return COMPLAINT_METRIC
      case DELIVERY_TYPE:
        return DELIVERY_METRIC
    }
  }

  timestamp () {
    const time = get(this.message, 'mail.timestamp')
    const date = time ? new Date(time) : /* istanbul ignore next: difficult to test without time mocks */ new Date()
    return parseInt(date.getTime() / 1000)
  }

  tag (tag, path, transform = identity) {
    if (has(this.message, path)) {
      const value = transform(toLower(get(this.message, path)))
      return truncate(`${tag}:${value}`, { length: 200, omission: '' })
    }
  }

  sourceArnTag () {
    return this.tag('source_arn', 'mail.sourceArn')
  }

  senderTag () {
    return this.tag('sender', 'mail.source')
  }

  callerIdentityTag () {
    return this.tag('caller_identity', 'mail.callerIdentity')
  }

  subjectTag () {
    return this.tag(
      'subject',
      'mail.commonHeaders.subject',
      this.sanitizeTagValue
    )
  }

  recipientTag (emailAddress) {
    const domain = emailAddress.split('@').pop()
    /* istanbul ignore else */
    if (domain) {
      const value = truncate(this.sanitizeTagValue(domain), { length: 200, omission: '' })
      return truncate(`recipient_domain:${value}`)
    }
  }

  bounceTypeTag () {
    return this.tag('bounce_type', 'bounce.bounceType')
  }

  bounceSubTypeTag () {
    return this.tag('bounce_sub_type', 'bounce.bounceSubType')
  }

  complaintTypeTag () {
    return this.tag('complaint_type', 'complaint.complaintFeedbackType')
  }

  sanitizeTagValue (value) {
    return value.replace(/[^a-zA-Z0-9_\-:.\\/]/g, '_').replace(/__+/g, '_')
  }
}

export default DataDogMetrics
