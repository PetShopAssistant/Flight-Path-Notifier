# Flight Path Landing Notifications
## I have a problem.
#### The problem
I like to sleep with the window open, but planes start flying overhead at 6am and wake me up.

#### The variables
- Two runways: one used from 6am–3pm, the other from 3pm–end of day.
- 6am–7am: both runways used because it’s busy.
- Schedule alternates weekly — one week the southern runway is in use in the morning, the next week in the afternoon.
- Planes must land/take off into a headwind — if the wind is from east to west, they land from the west and it stays quiet.
- Night flights

#### The solution
A script that checks the landing schedule and weather, then sends me a phone notification each evening telling me if planes will be overhead the next morning, so I can decide whether to leave the window open.

I started off using python and bit of vibe coding to make the basic script that would take a table of the landing schedule provided from the airport website and the weather forecast  data from [open-meteo](https://open-meteo.com/) and when run it would produce a message saying if the the planes would be flying overhead at 6am the next morning or not.
