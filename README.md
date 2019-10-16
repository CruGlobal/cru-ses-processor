# cru-ses-processor
Lambda that processes all SES bounces, complaints and deliveries, sends metrics to DataDog and forwards to a filterable SNS queue

# Features
- [x] `all-ses-events-filterable` SNS queue
- [ ] DataDog metrics for delivered, bounced and complaints
- [ ] API to query existing bounced email list

## SNS Subscriptions
All application subscriptions for SES events (bounce, complaint, delivery) should be added to the [`all-ses-events-filterable` queue](https://console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:056154071827:all-ses-events-filterable).
This queue is a duplicate of `all-ses-events` and includes messageAttributes which allow [SNS subscription filter policies](https://docs.aws.amazon.com/sns/latest/dg/sns-subscription-filter-policies.html).

The following filterable attributes are exposed:

Attribute             | Data Type    | Description
--------------------- | ------------ | -------------
notificationType      | String       | A string that holds the type of notification represented by the JSON object. Possible values are `Bounce`, `Complaint`, or `Delivery`.
source                | String       | The email address from which the original message was sent (the envelope MAIL FROM address).
destination           | String.Array | A list of email addresses that were recipients of the original mail.
bounceType            | String       | The type of bounce, as determined by Amazon SES. For more information, see [Bounce Types](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#bounce-types).
bounceSubType         | String       | The subtype of the bounce, as determined by Amazon SES. For more information, see [Bounce Types](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#bounce-types).
bouncedRecipients     | String.Array | A list of email addresses that were recipients of the original mail that bounced.
complainedRecipients  | String.Array | A list of email addresses that were recipients that may have been responsible for the complaint.
complaintFeedbackType | String       | The value of the Feedback-Type field from the feedback report received from the ISP. See [Complaint Types](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#complaint-types).
recipients            | String.Array | A list of the intended recipients of the email to which the delivery notification applies. 

### Filter Policy Examples
* Filter on `Permanent` bounce type from `no-reply@cru.org`:
```json
{
  "bounceType": "Permanent",
  "source": "no-reply@cru.org"
}
```
See [Filter Policies](https://docs.aws.amazon.com/sns/latest/dg/sns-subscription-filter-policies.html) for more examples and how to handle array fields.
