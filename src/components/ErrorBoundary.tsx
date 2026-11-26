import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Đã xảy ra lỗi kết nối dữ liệu. Vui lòng tải lại trang.';
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error) {
          friendly = `Lỗi thao tác dữ liệu (${parsed.operationType || 'unknown'}): ${parsed.error}`;
        }
      } catch {
        // non-JSON message
      }

      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#FFF0F5] px-4 text-[#3A071F]">
          <div className="w-full max-w-md rounded-3xl border border-[#B65A7C]/30 bg-white p-8 text-center shadow-lg">
            <h1 className="font-cute mb-3 text-2xl font-bold text-[#3A071F]">
              Có chút trục trặc nhỏ
            </h1>
            <p className="mb-6 break-words text-sm text-[#6F1F3B]">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] cursor-pointer rounded-full bg-[#6F1F3B] px-6 py-2.5 text-sm font-bold text-[#FFF0F5] hover:bg-[#3A071F]"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
