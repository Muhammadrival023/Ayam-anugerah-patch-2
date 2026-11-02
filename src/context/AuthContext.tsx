import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db, testConnection } from '../firebase';

export interface AdminUser {
  username: string;
  role: 'admin';
  displayName: string;
  email: string;
  deviceId: string;
  loginAt: string;
}

interface AuthContextType {
  user: User | null;
  adminUser: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  isOnline: boolean;
  loginWithCredentials: (
    username: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_SESSION_KEY = 'ayamanugerah_admin_session_v1';
const STORAGE_DEVICE_KEY = 'ayamanugerah_device_id_v1';

function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_DEVICE_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem(STORAGE_DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_temp_' + Date.now().toString(36);
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  adminUser: null,
  isAuthenticated: false,
  loading: true,
  isOnline: true,
  loginWithCredentials: async () => ({ success: false }),
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Check saved session on boot
  useEffect(() => {
    try {
      const savedLocal = localStorage.getItem(STORAGE_SESSION_KEY);
      const savedSession = sessionStorage.getItem(STORAGE_SESSION_KEY);
      const raw = savedLocal || savedSession;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.username === 'admin') {
          setAdminUser(parsed);
        }
      }
    } catch (e) {
      console.warn('Session restoration notice:', e);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial connection test per Firebase guidelines
    testConnection().catch(console.warn);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Pengguna FinTrack',
              photoURL: currentUser.photoURL || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('User profile sync notice:', err);
        }
      }
      setLoading(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  // Admin Credentials Login (akun: admin, password: admin123)
  const loginWithCredentials = async (
    username: string,
    password: string,
    rememberMe = true
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (cleanUser === 'admin' && cleanPass === 'admin123') {
      const deviceId = getOrCreateDeviceId();
      const newAdmin: AdminUser = {
        username: 'admin',
        role: 'admin',
        displayName: 'Administrator Gudang',
        email: 'admin@ayamanugerah.com',
        deviceId,
        loginAt: new Date().toISOString(),
      };

      setAdminUser(newAdmin);

      try {
        const payload = JSON.stringify(newAdmin);
        if (rememberMe) {
          localStorage.setItem(STORAGE_SESSION_KEY, payload);
          sessionStorage.removeItem(STORAGE_SESSION_KEY);
        } else {
          sessionStorage.setItem(STORAGE_SESSION_KEY, payload);
          localStorage.removeItem(STORAGE_SESSION_KEY);
        }
      } catch (err) {
        console.warn('Could not persist session:', err);
      }

      return { success: true };
    }

    return {
      success: false,
      error: 'Akun atau kata sandi tidak sesuai! Gunakan akun: admin dan password: admin123',
    };
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign In Error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setAdminUser(null);
      localStorage.removeItem(STORAGE_SESSION_KEY);
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
      await fbSignOut(auth);
    } catch (error) {
      console.error('Sign Out Error:', error);
      throw error;
    }
  };

  const isAuthenticated = Boolean(adminUser || user);

  return (
    <AuthContext.Provider
      value={{
        user,
        adminUser,
        isAuthenticated,
        loading,
        isOnline,
        loginWithCredentials,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
