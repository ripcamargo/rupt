import { useState, useEffect } from 'react';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { saveUserData, loadUserData } from '../utils/firestore';
import { CloseIcon } from './Icons';
import '../styles/UserProfileModal.css';

function UserProfileModal({ isOpen, onClose, user, userPhoto }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photoBase64, setPhotoBase64] = useState(userPhoto || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    setPhotoBase64(userPhoto || '');
  }, [userPhoto]);

  useEffect(() => {
    if (isOpen && user) {
      // Reset state when modal opens
      setDisplayName(user.displayName || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPhotoBase64(userPhoto || '');
      setError('');
      setSuccess('');
    }
  }, [isOpen, user, userPhoto]);

  if (!isOpen || !user) return null;

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetMessages();
    setDisplayName(user?.displayName || '');
    setPhotoBase64(userPhoto || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      setError('Foto muito grande (máximo 500KB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoBase64(event.target?.result || '');
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!displayName.trim()) {
      setError('Nome não pode estar vazio');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfile(user, {
        displayName: displayName.trim(),
      });

      // Save photo to Firestore
      const userData = await loadUserData(user.uid);
      await saveUserData(user.uid, {
        tasks: userData?.tasks || [],
        settings: userData?.settings || null,
        photoURL: photoBase64 || null,
      });

      setSuccess('Perfil atualizado com sucesso!');
      setTimeout(() => {
        resetMessages();
        window.location.reload(); // Reload to refresh photo
      }, 1000);
    } catch (err) {
      setError(err?.message || 'Erro ao atualizar perfil');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Novas senhas não conferem');
      return;
    }

    if (newPassword.length < 6) {
      setError('Nova senha deve ter no minimo 6 caracteres');
      return;
    }

    setIsSubmitting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        resetMessages();
      }, 2000);
    } catch (err) {
      if (err?.code === 'auth/wrong-password') {
        setError('Senha atual incorreta');
      } else {
        setError(err?.message || 'Erro ao alterar senha');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      handleClose();
    } catch (err) {
      setError('Erro ao fazer logout');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setDeleteError('Email não confere com o da conta.');
      return;
    }
    setIsDeleting(true);
    setDeleteError('');
    try {
      // Re-authenticate first (required by Firebase before sensitive ops)
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);
      // Wipe Firestore user data, then delete Firebase Auth account
      await saveUserData(user.uid, { tasks: [], settings: null, projects: [], photoURL: null });
      await deleteUser(user);
      // Auth state change listener in App.jsx will handle cleanup + navigate
    } catch (err) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setDeleteError('Senha incorreta.');
      } else {
        setDeleteError(err?.message || 'Erro ao excluir conta.');
      }
      setIsDeleting(false);
    }
  };

  return (
    <div className="profile-modal-overlay" onClick={handleClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>Meu Perfil</h2>
          <button className="profile-close" onClick={handleClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        <form className="profile-form">
          <h3 className="profile-section-title">Dados Pessoais</h3>
          
          <div className="profile-photo-section">
            {photoBase64 ? (
              <img src={photoBase64} alt="Usuario" className="profile-photo" />
            ) : (
              <div className="profile-photo-placeholder">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <label className="profile-photo-input">
              <input type="file" accept="image/*" onChange={handlePhotoChange} />
              Alterar foto
            </label>
          </div>

          <label className="profile-field">
            <span>Nome</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
            />
          </label>

          <label className="profile-field">
            <span>Email</span>
            <input type="email" value={user.email} disabled />
          </label>

          <button 
            type="button" 
            className="profile-submit" 
            onClick={handleUpdateProfile}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Dados'}
          </button>

          <div className="profile-divider"></div>

          <h3 className="profile-section-title">Alterar Senha</h3>

          <label className="profile-field">
            <span>Senha atual</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Sua senha atual"
            />
          </label>

          <label className="profile-field">
            <span>Nova senha</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
            />
          </label>

          <label className="profile-field">
            <span>Confirmar nova senha</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova senha"
            />
          </label>

          {error && <p className="profile-error">{error}</p>}
          {success && <p className="profile-success">{success}</p>}

          <button 
            type="button" 
            className="profile-submit profile-password-button" 
            onClick={handleChangePassword}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </form>

        <div className="profile-footer">
          <button className="profile-signout" onClick={handleSignOut}>
            Sair da conta
          </button>

          <button
            className="profile-delete-toggle"
            onClick={() => { setShowDeleteZone((v) => !v); setDeleteError(''); setDeleteConfirmEmail(''); setDeletePassword(''); }}
          >
            {showDeleteZone ? 'Cancelar exclusão' : 'Excluir conta'}
          </button>

          {showDeleteZone && (
            <div className="profile-delete-zone">
              <p className="profile-delete-warning">
                Esta ação é <strong>irreversível</strong>. Todos os seus dados serão apagados permanentemente.
              </p>
              <input
                className="profile-delete-input"
                type="email"
                placeholder={`Digite seu email (${user.email}) para confirmar`}
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              />
              <input
                className="profile-delete-input"
                type="password"
                placeholder="Sua senha atual"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
              {deleteError && <p className="profile-error">{deleteError}</p>}
              <button
                className="profile-delete-confirm"
                onClick={handleDeleteAccount}
                disabled={isDeleting || !deleteConfirmEmail || !deletePassword}
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar exclusão de conta'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfileModal;
