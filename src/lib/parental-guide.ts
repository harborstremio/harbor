import { safeFetch } from "./safe-fetch";
import { createParentalGuideClient } from "./parental-guide-client";

const BASE = "https://api.balloonerismm.workers.dev";

export type {
  GuideCategory,
  GuideItem,
  ParentalGuide,
  SeverityVote,
} from "./parental-guide-client";

export type Certificate = {
  id: string;
  rating: string;
  country: string;
  country_name: string;
};

const parentalGuideClient = createParentalGuideClient(safeFetch, BASE);

export const fetchParentalGuide = parentalGuideClient.fetchParentalGuide;
export const fetchParentalGuideMore = parentalGuideClient.fetchParentalGuideMore;
