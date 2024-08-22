import React, { useEffect, useState, useRef } from 'react';
import { firebaseConfig } from './firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { User } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export default function Header() {
    const [user, setUser] = useState<User | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const [showLoginCard, setShowLoginCard] = useState(false);
    const loginCardRef = useRef<HTMLDivElement | null>(null); // Reference for login card

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => unsubscribe();
    }, [user]);

    const handleLogout = () => {
        signOut(auth);
        setDropdownOpen(false); // Close the dropdown on logout
    };

    const toggleDropdown = () => {
        setDropdownOpen(!dropdownOpen);
    };

    // Close the dropdown if clicked outside
    useEffect(() => {
        const handleClickOutside = (event: any) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Close the login card if clicked outside
    useEffect(() => {
        const handleClickOutsideLoginCard = (event: any) => {
            if (loginCardRef.current && !loginCardRef.current.contains(event.target)) {
                setShowLoginCard(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutsideLoginCard);
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideLoginCard);
        };
    }, []);

    const Login = () => {
        const handleGoogleLogin = async () => {
            try {
                await signInWithPopup(auth, provider);
                setShowLoginCard(false); // Close the login card after successful login
            } catch (error) {
                console.error('Error signing in with Google: ', error);
            }
        };
    
        return (
            <div className="flex flex-row gap-4 flex-wrap justify-center m-auto">
                <button
                    onClick={handleGoogleLogin}
                    className="cursor-pointer hover:underline border border-white rounded-md px-4 py-4 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faGoogle} />
                    Sign in with Google
                </button>
            </div>
        );
    };

    return (
        <header className="flex justify-between items-center p-4 text-white absolute top-4 right-2">
            {/* show login card as a modal */}
            {showLoginCard && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-[#2e2e2e] rounded-lg shadow-lg max-w-[800px] max-h-[600px] p-2">
                    <Login />
                </div>
                </div>
            )}
            <div>
                {user ? (
                    <div className="relative" ref={dropdownRef}>
                        <span
                            onClick={toggleDropdown}
                            className="cursor-pointer hover:underline border border-white rounded-md px-4 py-4"
                        >
                            {user.email}
                        </span>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-6 bg-[#eeeeee] text-black rounded-md shadow-lg z-10">
                                <button
                                    onClick={handleLogout}
                                    className="block w-full text-center px-4 py-2 hover:bg-[#aaaaaa] rounded-md"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => setShowLoginCard(true)}
                        className="block w-full bg-[#eeeeee] text-black text-center px-4 py-2 hover:bg-[#aaaaaa] rounded-md"
                    >
                        Login
                    </button>
                )}
            </div>
        </header>
    );
}