import { useEffect, useState } from "react";
import {
  fetchProductionFacts,
  productionCached,
  productionKey,
  subscribeProduction,
  type ProductionFacts,
  type ProductionRequest,
} from "@/lib/providers/shotonwhat";

export function useProductionFacts(request: ProductionRequest | null): ProductionFacts | null {
  const key = request ? productionKey(request) : "";
  const title = request?.title ?? "";
  const originalTitle = request?.originalTitle ?? "";
  const year = request?.year ?? "";
  const imdbId = request?.imdbId ?? "";

  const [facts, setFacts] = useState<ProductionFacts | null>(() =>
    key ? productionCached(key) : null,
  );

  useEffect(() => {
    if (!key) {
      setFacts(null);
      return;
    }
    setFacts(productionCached(key));
    void fetchProductionFacts({
      title,
      originalTitle: originalTitle || undefined,
      year: year || undefined,
      imdbId: imdbId || null,
    });
    return subscribeProduction(() => setFacts(productionCached(key)));
  }, [key, title, originalTitle, year, imdbId]);

  return facts;
}
