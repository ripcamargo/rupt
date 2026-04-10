import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, updateProfile, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth, GoogleAuthProvider } from '../utils/firebase';
import { CloseIcon } from './Icons';
import '../styles/AuthModal.css';

function AuthModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePasswordReset = async () => {
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Informe seu email para receber o link de redefinicao.');
      return;
    }

    setIsSubmitting(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(auth, normalizedEmail, actionCodeSettings);
      setSuccess('Enviamos um link para redefinir sua senha. Verifique sua caixa de entrada.');
    } catch (err) {
      const message = err?.message || 'Erro ao enviar email de redefinicao. Tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      setError('Informe email e senha.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Informe seu nome.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );
        await updateProfile(result.user, { displayName: name.trim() });
        
        // Configurações do email de verificação
        const actionCodeSettings = {
          url: window.location.origin,
          handleCodeInApp: false,
        };
        
        await sendEmailVerification(result.user, actionCodeSettings);
        setSuccess('🎉 Conta criada! Enviamos um link de verificação para seu email. Verifique sua caixa de entrada.');
        setTimeout(() => handleClose(), 3000);
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
        handleClose();
      }
    } catch (err) {
      const message = err?.message || 'Erro ao autenticar. Tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setSuccess('');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      handleClose();
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(err?.message || 'Erro ao entrar com Google. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-header">
          <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
          <button className="auth-close" onClick={handleClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label className="auth-field">
              <span>Nome</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@empresa.com"
            />
          </label>

          <label className="auth-field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimo 6 caracteres"
            />
          </label>

          {mode === 'login' && (
            <div className="auth-forgot">
              <button type="button" onClick={handlePasswordReset} disabled={isSubmitting}>
                Esqueci minha senha
              </button>
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Enviando...'
              : mode === 'login'
                ? 'Entrar'
                : 'Cadastrar'}
          </button>
        </form>

        <div className="auth-divider">
          <span>ou</span>
        </div>

        <button
          type="button"
          className="auth-google"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
        >
          <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar com Google
        </button>

        <div className="auth-switch">
          <span>
            {mode === 'login'
              ? 'Ainda nao tem conta?'
              : 'Ja possui conta?'}
          </span>
          <button type="button" onClick={switchMode}>
            {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
