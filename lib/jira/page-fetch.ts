export type JiraPageFetch = {
  type: "JIRA_PAGE_FETCH";
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type JiraPageFetchResult = {
  ok?: boolean;
  status?: number;
  text?: string;
  error?: string;
};
