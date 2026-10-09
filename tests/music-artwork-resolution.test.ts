import test from "node:test";
import assert from "node:assert/strict";
import { sizeImageUrl, upgradeArtworkUrl } from "../src/lib/img-size";

test("a YouTube Music cover is requested at the size it will be shown", () => {
  const url = "https://lh3.googleusercontent.com/abc=w120-h120-l90-rj";
  assert.equal(
    upgradeArtworkUrl(url, 960),
    "https://lh3.googleusercontent.com/abc=w960-h960-l90-rj",
  );
});

test("a Deezer cover is upgraded past the 500px default", () => {
  const url = "https://e-cdns-images.dzcdn.net/images/cover/abc/500x500-000000-80-0-0.jpg";
  assert.equal(
    upgradeArtworkUrl(url, 1000),
    "https://e-cdns-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg",
  );
});

test("requests are capped so a huge display cannot ask for something the cdn will not serve", () => {
  assert.match(
    upgradeArtworkUrl("https://lh3.googleusercontent.com/a=w120-h120", 9000),
    /=w1200-h1200/,
  );
  assert.match(
    upgradeArtworkUrl("https://e-cdns-images.dzcdn.net/images/cover/a/500x500-0.jpg", 9000),
    /1000x1000/,
  );
});

test("TMDB sizing still wins and is untouched", () => {
  assert.equal(
    sizeImageUrl("https://image.tmdb.org/t/p/w185/x.jpg", 800),
    "https://image.tmdb.org/t/p/w1280/x.jpg",
  );
  assert.equal(
    sizeImageUrl("https://image.tmdb.org/t/p/w185/x.jpg", 700),
    "https://image.tmdb.org/t/p/w780/x.jpg",
  );
});

test("an unknown host is never rewritten", () => {
  const url = "https://example.com/cover.jpg";
  assert.equal(sizeImageUrl(url, 900), url);
});

test("a size of zero leaves the url alone, so an unmeasured poster is not downgraded", () => {
  const url = "https://lh3.googleusercontent.com/abc=w120-h120";
  assert.equal(upgradeArtworkUrl(url, 0), url);
});

test("sizeImageUrl routes music covers through the upgrade", () => {
  assert.match(sizeImageUrl("https://lh3.googleusercontent.com/abc=w120-h120", 600), /=w600-h600/);
});
