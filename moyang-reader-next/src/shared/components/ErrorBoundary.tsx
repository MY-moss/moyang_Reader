import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Injectable for tests; production falls back to a full page reload. */
  reloadApp?: () => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

function toError(error: unknown) {
  return error instanceof Error ? error : new Error("未知界面错误");
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Moyang Reader render error", error, info.componentStack);
  }

  private handleReload = () => {
    if (this.props.reloadApp) {
      this.props.reloadApp();
      return;
    }

    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.error.message.trim();

    return (
      <main className="app-crash-state" role="alert" aria-labelledby="app-crash-title">
        <div className="app-crash-mark" aria-hidden="true">
          !
        </div>
        <div className="panel-kicker">RECOVERABLE ERROR</div>
        <h1 id="app-crash-title">界面暂时无法显示</h1>
        <p>
          应用遇到了一次界面错误。重新加载只会重启界面；已经保存到磁盘的文件不会被改写。
          如果刚才有未保存编辑，请先检查本地草稿恢复提示。
        </p>
        {message ? (
          <details className="app-crash-details">
            <summary>查看错误详情</summary>
            <code>{message}</code>
          </details>
        ) : null}
        <button type="button" className="toolbar-button primary" onClick={this.handleReload}>
          重新加载界面
        </button>
      </main>
    );
  }
}
