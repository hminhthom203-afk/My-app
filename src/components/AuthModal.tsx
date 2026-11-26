import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { Eye, EyeOff, MailCheck, RefreshCw, LogOut, X } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  onRefreshAuth: () => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  currentUser,
  onRefreshAuth,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [suggestRegister, setSuggestRegister] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSuggestRegister(false);
    if (currentUser && !currentUser.emailVerified) {
      setAwaitingVerification(true);
      setInfo(
        `Tài khoản ${currentUser.email} hiện chưa xác minh Gmail nên chưa thể thả tim hoặc bình luận. Hãy mở Gmail bấm vào liên kết xác minh (kiểm tra cả mục Thư rác / Spam), rồi bấm "Tôi đã xác minh email".`
      );
    } else {
      setAwaitingVerification(false);
      setInfo('');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleCheckVerification = async () => {
    if (!auth.currentUser) return;
    setError('');
    setBusy(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        await auth.currentUser.getIdToken(true);
        onRefreshAuth();
        onClose();
      } else {
        setError(
          'Email vẫn chưa được xác minh. Hãy mở hộp thư Gmail (kể cả Thư rác / Spam), bấm vào liên kết xác minh từ Firebase rồi bấm lại nút này.'
        );
      }
    } catch {
      setError('Không thể kiểm tra trạng thái xác minh lúc này. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setError('');
    setBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setInfo(
        `Đã gửi lại liên kết xác minh tới ${auth.currentUser.email || 'Gmail của bạn'}. Hãy kiểm tra cả hộp thư đến và Thư rác (Spam).`
      );
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/too-many-requests') {
        setError(
          'Bạn vừa gửi yêu cầu quá nhiều lần. Vui lòng đợi 1–2 phút hoặc kiểm tra email xác minh đã gửi trước đó trong hộp thư / Spam.'
        );
      } else {
        setError('Không gửi lại được email xác minh. Vui lòng thử lại sau ít phút.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchAccount = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await signOut(auth);
      setAwaitingVerification(false);
      setMode('login');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setInfo('');
    setSuggestRegister(false);
    setAwaitingVerification(false);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onRefreshAuth();
      onClose();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Cửa sổ đăng nhập Google đã bị đóng.');
      } else if (code === 'auth/popup-blocked') {
        setError('Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép popup hoặc đăng nhập bằng Gmail + mật khẩu.');
      } else if (code === 'auth/account-exists-with-different-credential') {
        setError('Gmail này đã đăng ký bằng mật khẩu trước đó. Vui lòng đăng nhập bằng Gmail và mật khẩu.');
      } else {
        setError(
          `Không thể đăng nhập bằng Google lúc này${code ? ` (${code})` : ''}. Bạn có thể thử trình duyệt Chrome hoặc đăng ký bằng Gmail + mật khẩu bên trên.`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSuggestRegister(false);
    setAwaitingVerification(false);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Vui lòng nhập đầy đủ Gmail và mật khẩu.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        await cred.user.reload().catch(() => {});
        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user).catch(() => {});
          setAwaitingVerification(true);
          setInfo(
            `Tài khoản ${cleanEmail} chưa xác minh email. Một liên kết xác minh đã được gửi tới Gmail của bạn (kiểm tra cả mục Thư rác / Spam).`
          );
          return;
        }
        await cred.user.getIdToken(true).catch(() => {});
        onRefreshAuth();
        onClose();
      } else {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
        }
        await sendEmailVerification(cred.user).catch(() => {});
        onRefreshAuth();
        setAwaitingVerification(true);
        setInfo(
          `Đăng ký thành công! Vui lòng mở hộp thư ${cleanEmail} (kiểm tra cả Thư rác / Spam) bấm vào liên kết xác minh rồi bấm "Tôi đã xác minh email" bên dưới.`
        );
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
        setError(
          'Phương thức Email/Mật khẩu chưa được bật trong Firebase Console. Hãy bật Email/Password trong Firebase Authentication hoặc dùng nút Đăng nhập bằng Google.'
        );
      } else if (code === 'auth/user-not-found') {
        setError('Gmail này chưa có tài khoản. Vui lòng đăng ký tài khoản mới trước khi đăng nhập.');
        setSuggestRegister(true);
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError(
          'Tài khoản chưa đăng ký hoặc mật khẩu chưa đúng. Nếu bạn chưa có tài khoản, vui lòng đăng ký ngay.'
        );
        setSuggestRegister(true);
      } else if (code === 'auth/email-already-in-use') {
        setError('Gmail này đã được đăng ký. Hãy chuyển sang Đăng nhập.');
      } else if (code === 'auth/weak-password') {
        setError('Mật khẩu cần ít nhất 6 ký tự.');
      } else {
        setError('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3A071F]/65 px-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-[#E2A6BA]/45 bg-[#FFF0F5] p-6 text-[#3A071F] shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute top-4 right-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="auth-dialog-title" className="font-cute mb-5 text-2xl font-bold text-[#3A071F]">
          {awaitingVerification
            ? 'Xác Minh Gmail'
            : mode === 'login'
              ? 'Đăng Nhập'
              : 'Đăng Ký Tài Khoản'}
        </h2>

        {awaitingVerification ? (
          <div className="space-y-4">
            {info && (
              <div className="rounded-2xl border border-[#B65A7C]/25 bg-[#E2A6BA]/30 px-4 py-3 text-xs leading-relaxed font-semibold text-[#3A071F]">
                {info}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-[#6F1F3B]/10 px-3.5 py-2.5 text-xs font-semibold text-[#6F1F3B]">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={handleCheckVerification}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#6F1F3B] px-5 py-2.5 text-sm font-bold text-[#FFF0F5] transition-colors hover:bg-[#3A071F] disabled:opacity-60"
              >
                <MailCheck className="h-4 w-4" />
                <span>{busy ? 'Đang kiểm tra...' : 'Tôi đã xác minh email'}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleResendVerification}
                className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#B65A7C]/40 bg-white px-5 py-2 text-xs font-bold text-[#6F1F3B] transition-colors hover:bg-[#E2A6BA]/25 disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Gửi lại email xác minh</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#B65A7C]/40 bg-white px-5 py-2 text-xs font-bold text-[#3A071F] transition-colors hover:bg-[#E2A6BA]/25 disabled:opacity-60"
              >
                <span>Hoặc đăng nhập bằng Google (tự động xác minh)</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleSwitchAccount}
                className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-1.5 text-xs font-semibold text-[#6F1F3B] underline underline-offset-4 hover:text-[#3A071F]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Đăng xuất / Dùng tài khoản khác</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
                    Tên hiển thị
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={80}
                    className="min-h-[44px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3.5 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">Gmail</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3.5 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">Mật khẩu</label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-[#B65A7C]/30 bg-white py-2 pr-12 pl-3.5 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Xem mật khẩu'}
                    className="absolute right-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-[#6F1F3B]/10 px-3 py-2.5 text-xs font-semibold text-[#6F1F3B]">
                  <p>{error}</p>
                  {suggestRegister && mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setSuggestRegister(false);
                        setMode('register');
                      }}
                      className="mt-1.5 cursor-pointer text-xs font-bold text-[#3A071F] underline underline-offset-4 hover:text-[#6F1F3B]"
                    >
                      Chuyển sang Đăng ký tài khoản ngay
                    </button>
                  )}
                </div>
              )}

              {info && (
                <div className="rounded-xl bg-[#E2A6BA]/35 px-3 py-2.5 text-xs font-semibold text-[#3A071F]">
                  <p>{info}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] w-full cursor-pointer rounded-full bg-[#6F1F3B] px-5 py-2.5 text-sm font-bold text-[#FFF0F5] transition-colors hover:bg-[#3A071F] disabled:opacity-60"
              >
                {busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#B65A7C]/25" />
              <span className="text-xs text-[#B65A7C]">hoặc</span>
              <div className="h-px flex-1 bg-[#B65A7C]/25" />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-[#B65A7C]/40 bg-white px-5 py-2.5 text-sm font-bold text-[#3A071F] transition-colors hover:bg-[#E2A6BA]/25 disabled:opacity-60"
            >
              <span>Đăng nhập bằng Google</span>
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setInfo('');
                  setSuggestRegister(false);
                  setMode(mode === 'login' ? 'register' : 'login');
                }}
                className="cursor-pointer text-xs font-semibold text-[#6F1F3B] underline underline-offset-4 hover:text-[#3A071F]"
              >
                {mode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
