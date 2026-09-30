export type SitePageFetch = {
  type: "SITE_PAGE_FETCH";
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type SitePageFetchResult = {
  ok?: boolean;
  status?: number;
  text?: string;
  error?: string;
};

export type JiraPageFetch = SitePageFetch & { type: "JIRA_PAGE_FETCH" | "SITE_PAGE_FETCH" };
export type JiraPageFetchResult = SitePageFetchResult;
