# Event Ticketing Platform -- Domain Model

## Bounded Context: Event Ticketing

---

## Entities

### Event (Aggregate Root)

The central aggregate. An organizer creates an event with one or more ticket tiers. The event governs inventory, sales windows, and refund policy.

| Field | Type | Description |
|---|---|---|
| eventId | EventId | Unique identifier |
| organizerId | OrganizerId | The organizer who owns this event |
| name | String | Event name |
| description | String | Event description |
| venue | Venue | Where the event takes place |
| scheduledAt | DateTimeRange | Start and end of the event |
| ticketTiers | List\<TicketTier\> | Tier definitions (early bird, regular, VIP, etc.) |
| refundPolicy | RefundPolicy | Sliding-scale refund rules |
| status | EventStatus | Current lifecycle state |

### Ticket (Aggregate Root)

Represents a single issued ticket. Tickets are individually tracked for transfer, refund, and check-in.

| Field | Type | Description |
|---|---|---|
| ticketId | TicketId | Unique identifier |
| eventId | EventId | The event this ticket is for |
| tierId | TierId | Which tier this ticket belongs to |
| holderId | BuyerId | Current holder of the ticket |
| originalBuyerId | BuyerId | Person who originally purchased |
| purchasedAt | DateTime | When the ticket was bought |
| pricePaid | Money | Amount paid at purchase |
| status | TicketStatus | Current lifecycle state |

### WaitlistEntry

Tracks a buyer waiting for a spot on a sold-out tier.

| Field | Type | Description |
|---|---|---|
| waitlistEntryId | WaitlistEntryId | Unique identifier |
| eventId | EventId | Target event |
| tierId | TierId | Target tier |
| buyerId | BuyerId | Who is waiting |
| joinedAt | DateTime | When they joined the waitlist |
| position | Integer | Queue position |
| status | WaitlistStatus | Active, Offered, Converted, Expired, Cancelled |

### Organizer

| Field | Type | Description |
|---|---|---|
| organizerId | OrganizerId | Unique identifier |
| name | String | Organizer or company name |
| contactEmail | EmailAddress | Contact email |

### Buyer

| Field | Type | Description |
|---|---|---|
| buyerId | BuyerId | Unique identifier |
| name | PersonName | Full name |
| email | EmailAddress | Contact email |

---

## Value Objects

### TicketTier

Defines a category of tickets within an event.

| Field | Type | Description |
|---|---|---|
| tierId | TierId | Identifier within the event |
| name | String | e.g. "Early Bird", "Regular", "VIP" |
| price | Money | Face price |
| totalCapacity | PositiveInteger | Total number of tickets available |
| soldCount | NonNegativeInteger | Number sold so far |
| salesWindow | DateTimeRange | When this tier is on sale |
| benefits | List\<String\> | What the tier includes |

### RefundPolicy

A sliding-scale refund schedule. Each rule specifies a time threshold and the refund percentage that applies.

| Field | Type | Description |
|---|---|---|
| rules | List\<RefundRule\> | Ordered from most generous to least |

**Example rules:**
- 30+ days before event: 100% refund
- 15-29 days before event: 75% refund
- 7-14 days before event: 50% refund
- 1-6 days before event: 25% refund
- Day of event: 0% refund

### RefundRule

| Field | Type | Description |
|---|---|---|
| minimumDaysBefore | NonNegativeInteger | Minimum days before event for this rule to apply |
| refundPercentage | Percentage (0-100) | Percentage of price refunded |

### Money

| Field | Type |
|---|---|
| amount | Decimal |
| currency | CurrencyCode (ISO 4217) |

### DateTimeRange

| Field | Type |
|---|---|
| start | DateTime |
| end | DateTime |

**Invariant:** start < end

### Venue

| Field | Type |
|---|---|
| name | String |
| address | Address |
| capacity | PositiveInteger |

### Address

| Field | Type |
|---|---|
| street | String |
| city | String |
| postalCode | String |
| country | CountryCode |

### PersonName

| Field | Type |
|---|---|
| firstName | String |
| lastName | String |

### EmailAddress

Wrapper around String with format validation.

---

## Enumerations

### EventStatus

- `Draft` -- Event created but not yet published.
- `Published` -- Visible and tickets may be on sale depending on tier windows.
- `SoldOut` -- All tiers at capacity.
- `Ongoing` -- Event is currently happening.
- `Completed` -- Event has ended.
- `Cancelled` -- Event cancelled by organizer.

### TicketStatus

- `Reserved` -- Held during payment processing.
- `Confirmed` -- Payment succeeded; ticket is valid.
- `CheckedIn` -- Holder has been admitted.
- `Refunded` -- Ticket refunded and voided.
- `Transferred` -- Ownership moved to another buyer (a new Ticket is issued to the recipient).
- `Cancelled` -- Cancelled (e.g. event cancellation).

### WaitlistStatus

- `Active` -- Waiting in queue.
- `Offered` -- A spot opened up and the buyer was notified; awaiting acceptance.
- `Converted` -- Buyer accepted and purchased.
- `Expired` -- Offer window elapsed without response.
- `Cancelled` -- Buyer left the waitlist voluntarily.

---

## State Machines

### Event Lifecycle

```
Draft --> Published        [PublishEvent]
Published --> SoldOut      [all tiers reach capacity]
SoldOut --> Published      [tickets freed by refund/cancellation]
Published --> Ongoing      [event start time reached]
SoldOut --> Ongoing        [event start time reached]
Ongoing --> Completed      [event end time reached]
Draft --> Cancelled        [CancelEvent]
Published --> Cancelled    [CancelEvent]
SoldOut --> Cancelled      [CancelEvent]
```

### Ticket Lifecycle

```
(none) --> Reserved        [ReserveTicket]
Reserved --> Confirmed     [ConfirmPurchase / payment succeeds]
Reserved --> (none)        [reservation timeout / payment fails]
Confirmed --> Refunded     [RefundTicket]
Confirmed --> Transferred  [TransferTicket]
Confirmed --> CheckedIn    [CheckInTicket]
Confirmed --> Cancelled    [CancelEvent propagation]
```

### Waitlist Entry Lifecycle

```
(none) --> Active          [JoinWaitlist]
Active --> Offered         [spot becomes available]
Offered --> Converted      [buyer accepts and purchases]
Offered --> Expired        [offer window timeout]
Active --> Cancelled       [LeaveWaitlist]
```

---

## Commands

### Event Management

| Command | Issuer | Parameters | Preconditions |
|---|---|---|---|
| **CreateEvent** | Organizer | name, description, venue, scheduledAt, ticketTiers, refundPolicy | Organizer exists; scheduledAt is in the future |
| **PublishEvent** | Organizer | eventId | Event is in Draft; at least one tier defined |
| **UpdateEvent** | Organizer | eventId, fields to update | Event is Draft or Published; cannot reduce capacity below soldCount |
| **CancelEvent** | Organizer | eventId, reason | Event is not Completed or already Cancelled |

### Ticket Purchase

| Command | Issuer | Parameters | Preconditions |
|---|---|---|---|
| **ReserveTicket** | Buyer | eventId, tierId, buyerId | Event is Published; tier has remaining capacity; tier sales window is open |
| **ConfirmPurchase** | System | ticketId, paymentReference | Ticket is Reserved; payment succeeded |
| **CancelReservation** | System/Buyer | ticketId | Ticket is Reserved |

### Waitlist

| Command | Issuer | Parameters | Preconditions |
|---|---|---|---|
| **JoinWaitlist** | Buyer | eventId, tierId, buyerId | Tier is sold out; buyer not already on waitlist for this tier |
| **LeaveWaitlist** | Buyer | waitlistEntryId | Entry is Active |
| **OfferWaitlistSpot** | System | waitlistEntryId | Entry is Active; a ticket has become available |
| **AcceptWaitlistOffer** | Buyer | waitlistEntryId | Entry is Offered; offer not expired |

### Transfer

| Command | Issuer | Parameters | Preconditions |
|---|---|---|---|
| **TransferTicket** | Buyer (current holder) | ticketId, recipientBuyerId | Ticket is Confirmed; event has not started; recipient is a valid buyer; holder is current holderId |

### Refund

| Command | Issuer | Parameters | Preconditions |
|---|---|---|---|
| **RequestRefund** | Buyer (holder) | ticketId | Ticket is Confirmed; event has not started |

---

## Domain Events

### Event-related

| Event | Payload | Triggered By |
|---|---|---|
| **EventCreated** | eventId, organizerId, name, scheduledAt, tiers | CreateEvent |
| **EventPublished** | eventId | PublishEvent |
| **EventSoldOut** | eventId | last ticket reserved/confirmed |
| **EventCancelled** | eventId, reason | CancelEvent |
| **EventCompleted** | eventId | end time reached |

### Ticket-related

| Event | Payload | Triggered By |
|---|---|---|
| **TicketReserved** | ticketId, eventId, tierId, buyerId | ReserveTicket |
| **TicketPurchaseConfirmed** | ticketId, paymentReference, pricePaid | ConfirmPurchase |
| **ReservationExpired** | ticketId | timeout |
| **TicketRefunded** | ticketId, refundAmount, refundPercentage | RequestRefund (after policy evaluation) |
| **TicketTransferred** | ticketId, fromBuyerId, toBuyerId, newTicketId | TransferTicket |
| **TicketCancelledDueToEventCancellation** | ticketId, eventId | CancelEvent propagation |
| **TicketCheckedIn** | ticketId | CheckInTicket |

### Waitlist-related

| Event | Payload | Triggered By |
|---|---|---|
| **BuyerJoinedWaitlist** | waitlistEntryId, eventId, tierId, buyerId, position | JoinWaitlist |
| **WaitlistSpotOffered** | waitlistEntryId, expiresAt | OfferWaitlistSpot |
| **WaitlistOfferAccepted** | waitlistEntryId, ticketId | AcceptWaitlistOffer |
| **WaitlistOfferExpired** | waitlistEntryId | timeout |
| **BuyerLeftWaitlist** | waitlistEntryId | LeaveWaitlist |

---

## Domain Rules and Invariants

1. **Capacity enforcement:** `tier.soldCount <= tier.totalCapacity` at all times. A reservation must atomically decrement available capacity.
2. **Sales window:** A ticket for a tier can only be reserved while `now` falls within `tier.salesWindow` and the event is Published.
3. **Sliding-scale refund calculation:** When a refund is requested, the system evaluates `event.scheduledAt.start - now` in days, finds the matching `RefundRule` (highest `minimumDaysBefore` that is <= days remaining), and applies the corresponding percentage to `ticket.pricePaid`.
4. **Transfer restrictions:** A ticket can only be transferred once (original confirmed ticket is marked Transferred; a new Confirmed ticket is created for the recipient). The event must not have started.
5. **Waitlist fairness (FIFO):** When a ticket becomes available (refund or cancellation), the system offers it to the waitlist entry with the lowest position number first.
6. **Reservation timeout:** A reserved ticket that is not confirmed within a configurable duration (e.g. 15 minutes) is automatically released and capacity is restored.
7. **Event cancellation cascade:** When an event is cancelled, all Confirmed tickets are cancelled and full refunds are issued regardless of the refund policy.
8. **One active ticket per buyer per tier:** A buyer cannot hold more than one confirmed ticket for the same tier (they may hold tickets across different tiers).

---

## Process Flows

### Purchase Flow (Happy Path)

1. Buyer issues `ReserveTicket` for a tier.
2. System decrements available capacity, creates Ticket in `Reserved` status, emits `TicketReserved`.
3. Payment is processed externally.
4. On success, system issues `ConfirmPurchase`, ticket moves to `Confirmed`, emits `TicketPurchaseConfirmed`.
5. If tier is now at capacity, event may transition to `SoldOut`, emitting `EventSoldOut`.

### Waitlist-to-Purchase Flow

1. Buyer tries to reserve but tier is sold out. Buyer issues `JoinWaitlist`.
2. Later, another buyer refunds their ticket. System emits `TicketRefunded`, capacity opens.
3. System issues `OfferWaitlistSpot` to the first Active entry. Entry moves to `Offered` with an expiration window.
4. Buyer issues `AcceptWaitlistOffer` within the window. System reserves a ticket and proceeds with the normal purchase flow.
5. If the buyer does not respond, entry moves to `Expired` and the next entry is offered.

### Refund Flow

1. Buyer issues `RequestRefund`.
2. System computes days until event start and matches against `RefundPolicy.rules`.
3. Refund amount = `ticket.pricePaid * matchedRule.refundPercentage / 100`.
4. Ticket moves to `Refunded`. `TicketRefunded` is emitted with the amount.
5. Tier capacity is restored. If a waitlist exists, the waitlist-to-purchase flow is triggered.

### Transfer Flow

1. Current holder issues `TransferTicket` with the recipient's buyerId.
2. Original ticket moves to `Transferred` status.
3. A new Ticket is created for the recipient in `Confirmed` status with the same tierId and eventId.
4. `TicketTransferred` is emitted linking old and new ticket.
