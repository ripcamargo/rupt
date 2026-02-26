import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../utils/firebase';
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
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
          email.trim(),
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
        await signInWithEmailAndPassword(auth, email.trim(), password);
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
