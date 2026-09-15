export type JiraUser = {
  name?: string;
  key?: string;
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
};

export type JiraWorklog = {
  id: string;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
  comment?: string;
  author?: JiraUser;
};

export type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary: string;
    worklog?: {
      startAt: number;
      maxResults: number;
      total: number;
      worklogs: JiraWorklog[];
    };
  };
};

export type IssuePickerIssue = {
  key: string;
  summaryText?: string;
  summary?: string;
};

export type WorklogEntry = {
  id: string;
  issueKey: string;
  issueId: string;
  summary: string;
  started: string;
  dateKey: string;
  timeSpent: string;
  timeSpentSeconds: number;
  comment: string;
  authorName: string;
};

export type WeekLoadStats = {
  user: string;
  issues: number;
  entries: number;
  source: string;
  jql: string;
};
