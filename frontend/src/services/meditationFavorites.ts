import { apiFetch } from "./api";

type FavoritesResponse = {
  slugs: string[];
};

export async function fetchMeditationFavorites(token: string): Promise<string[]> {
  const response = await apiFetch<FavoritesResponse>(
    "/api/me/meditation-favorites",
    { token, timeoutMs: 5000, retries: 1 },
  );
  return Array.isArray(response.slugs) ? response.slugs : [];
}

export async function mergeMeditationFavorites(
  token: string,
  slugs: string[],
): Promise<string[]> {
  const response = await apiFetch<FavoritesResponse>(
    "/api/me/meditation-favorites/merge",
    {
      method: "POST",
      token,
      body: JSON.stringify({ slugs }),
      timeoutMs: 6000,
    },
  );
  return Array.isArray(response.slugs) ? response.slugs : [];
}

export async function setMeditationFavorite(
  token: string,
  slug: string,
  favorite: boolean,
): Promise<void> {
  await apiFetch(`/api/me/meditation-favorites/${encodeURIComponent(slug)}`, {
    method: favorite ? "PUT" : "DELETE",
    token,
    timeoutMs: 5000,
  });
}
