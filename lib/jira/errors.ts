export class JiraAuthError extends Error {
  constructor(message = "Нужно открыть Jira и войти в аккаунт") {
    super(message);
    this.name = "JiraAuthError";
  }
}

export class JiraApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "JiraApiError";
    this.status = status;
  }
}
