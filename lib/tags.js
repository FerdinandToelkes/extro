// Shared, curated interest-tag vocabulary. Used both for tagging an activity
// (components/NewActivityForm.js) and for the interests you subscribe to on
// your profile (app/profile/page.js). Tags are stored as free-text arrays in
// Postgres, so this list is purely a curated picker -- adding to it is safe
// and needs no migration. Keep entries short (they render as chips) and
// distinct from each other; overlap with `category` is fine, tags are their
// own vocabulary for discovery/matching.
export const TAGS = [
  "Outdoors",
  "Games",
  "Boardgames",
  "Videogames",
  "Music",
  "Concerts",
  "Fitness",
  "Running",
  "Cycling",
  "Hiking",
  "Climbing",
  "Yoga",
  "Coffee",
  "Food",
  "Cooking",
  "Nightlife",
  "Art",
  "Film",
  "Reading",
  "Photography",
  "Dancing",
  "Travel",
  "Learning",
  "Chill",
];
