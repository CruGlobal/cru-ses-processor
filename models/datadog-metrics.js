import { sendDistributionMetricWithDate } from 'datadog-lambda-js'
import get from 'lodash/get'
import has from 'lodash/has'
import toLower from 'lodash/toLower'
import identity from 'lodash/identity'
import truncate from 'lodash/truncate'
import compact from 'lodash/compact'
import { BOUNCE_TYPE, COMPLAINT_TYPE, DELIVERY_TYPE } from './ses-message'

const BOUNCE_METRIC = 'cru.sesv2.bounce'
const COMPLAINT_METRIC = 'cru.sesv2.complaint'
const DELIVERY_METRIC = 'cru.sesv2.delivery'

class DataDogMetrics {
  constructor (sesMessage) {
    this.sesMessage = sesMessage
  }

  get message () {
    return this.sesMessage.message
  }

  async send () {
    try {
      const metrics = this.recipientEmails().map(emailAddress => ({
        name: this.metric(),
        value: 1,
        metric_time: this.timestamp(),
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

      for (const metric of metrics) {
        sendDistributionMetricWithDate(
          metric.name,
          metric.value,
          metric.metric_time,
          ...metric.tags
        )
      }
      return Promise.resolve(metrics)
    } catch (err) {
      return Promise.reject(err)
    }
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
    return date
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
