import axios from "axios";

const BASE_URL = "https://api.superjob.ru/2.0";

export interface SuperJobCredentials {
  login: string;
  password: string;
  clientId: string;
  clientSecret: string;
  apiAppId: string;
}

export interface SuperJobTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface SuperJobVacancy {
  id: number;
  profession: string;
  firm_name: string;
  town?: { title?: string };
  payment_from?: number;
  payment_to?: number;
  currency?: string;
  experience?: { title?: string };
  place_of_work?: { title?: string };
  candidat?: string;
  link: string;
  date_published?: number;
}

export interface SuperJobSearchParams {
  keyword?: string;
  town?: string;
  payment_from?: number;
  payment_to?: number;
  experience?: number;
  page?: number;
  count?: number;
}

// SuperJob's public app-registration API does not expose a self-serve
// "submit application" call for job seekers - automated response submission
// is documented as requiring a paid partner integration. So unlike hh.ru,
// there's no applyToVacancy() here; the UI opens vacancy.link in the browser
// for the user to apply manually instead.

export async function login(creds: SuperJobCredentials): Promise<SuperJobTokens> {
  const response = await axios.post(
    `${BASE_URL}/oauth2/password/`,
    new URLSearchParams({
      login: creds.login,
      password: creds.password,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
    { headers: { "X-Api-App-Id": creds.apiAppId } }
  );
  return toTokens(response.data);
}

export async function refreshTokens(
  refreshToken: string,
  creds: Pick<SuperJobCredentials, "clientId" | "clientSecret" | "apiAppId">
): Promise<SuperJobTokens> {
  const response = await axios.get(`${BASE_URL}/oauth2/refresh_token/`, {
    params: {
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    },
    headers: { "X-Api-App-Id": creds.apiAppId },
  });
  return toTokens(response.data);
}

function toTokens(data: any): SuperJobTokens {
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "SuperJob login failed - check credentials.");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.ttl || 86400) * 1000,
  };
}

export async function searchVacancies(
  accessToken: string,
  apiAppId: string,
  params: SuperJobSearchParams
): Promise<{ objects: SuperJobVacancy[]; total: number }> {
  const response = await axios.get(`${BASE_URL}/vacancies/`, {
    params: {
      keyword: params.keyword,
      town: params.town,
      payment_from: params.payment_from,
      payment_to: params.payment_to,
      experience: params.experience,
      page: params.page ?? 0,
      count: params.count ?? 20,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Api-App-Id": apiAppId,
    },
  });
  return { objects: response.data.objects || [], total: response.data.total || 0 };
}
