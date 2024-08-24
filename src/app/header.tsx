import React, { useEffect, useState, useRef } from 'react';
import { firebaseConfig } from './firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import Notification from './notify';
import { GuessedCard } from './types';
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import getStripe from './api/utils/get-stripe';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(app);

export default function Header() {
    const [user, setUser] = useState<User | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showLoginCard, setShowLoginCard] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const loginCardRef = useRef<HTMLDivElement | null>(null); // Reference for login card
    const profileCardRef = useRef<HTMLDivElement | null>(null); // Reference for login card
    const [points, setPoints] = useState<number>(0);
    const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' |'info' } | null>(null);  // notification message
    const [needSubscription, setNeedSubscription] = useState<boolean>(true);

    // if user is not logged in, show login card every 2 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            if (!user) {
                setShowLoginCard(true);
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [user]);

    // show notification
    const triggerNotification = (nMessage: string, nType: 'error' | 'success' | 'info') => {
        setNotification({ message: nMessage, type: nType });
    };

    const fetchGuessedCards = async () => {
        if (!user || !user.email) {
            console.error("User is not logged in or email is missing");
            triggerNotification("User not authenticated", "error");
            return;
        }
        const userEmail = user.email;
        const querySnapshot = await getDocs(collection(firestore, 'guessedCards', userEmail, 'cards'));
        const cards: GuessedCard[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const gCard: GuessedCard = {
            id: data.id,
            imageUrl: data.imageUrl,
            prompt: data.prompt,
            guess: data.guess,
            grade: data.grade,
            point: data.point,
            createdAt: data.createdAt,
            };
            cards.push(gCard);
        });
        console.log("guessed cards: ", cards);
        // calculate total points
        const totalPoints = cards.reduce((acc, card) => acc + card.point, 0);
        setPoints(totalPoints);
        console.log("total points: ", totalPoints);
    };

    // get guessed cards from firebase database
    useEffect(() => {
        console.log("fetching guessed cards...");
        console.log("user: ", user);
        console.log("user email: ", user?.email);
        fetchGuessedCards();
    }, [user]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => unsubscribe();
    }, [user]);

    const getCurrentUser = () => {
        return new Promise((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                resolve(user);
                unsubscribe();
            }, reject);
        });
    };

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
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
            if (loginCardRef.current && !loginCardRef.current.contains(event.target as Node)) {
                setShowLoginCard(false);
            }
            if (profileCardRef.current && !profileCardRef.current.contains(event.target as Node)) {
                setShowProfile(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleStripe = async () => {
        const checkoutSession = await fetch('/api/checkout_sessions', {
            method: 'POST',
            headers: { origin: 'http://localhost:3000' },
        })
        const checkoutSessionJson = await checkoutSession.json()
      
        const stripe = await getStripe()
        const {error} = await stripe.redirectToCheckout({
            sessionId: checkoutSessionJson.id,
        })
      
        if (error) {
          console.warn(error.message)
        }
    };

    // fetch user subscription from firebase collection=subscriptions where email=user.email. save to state subscribeed
    const fetchUserSubscription = async () => {
        // const currentUser = await getCurrentUser();

      if (!user || !user.email) {
        console.error("User is not logged in or email is missing");
        triggerNotification("User not authenticated", "error");
        return;
      }
    
      const userEmail = user.email;
      const docRef = doc(firestore, 'subscriptions', userEmail);
    
      try {
        const docSnap = await getDoc(docRef);
    
        if (docSnap.exists()) {
            setNeedSubscription(false);
        } else {
            setNeedSubscription(true);
        }
      } catch (error) {
        console.error("Error fetching user subscription: ", error);
        triggerNotification("Error fetching subscription status", "error");
      }
    };

    // get user subscription from firebase database
    useEffect(() => {
        console.log("fetching user subscription...");
        console.log("user: ", user);
        console.log("user email: ", user?.email);
        fetchUserSubscription();
    }, [user]);

    // login component
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
            <div className="flex flex-row gap-4 flex-wrap justify-center m-auto" ref={loginCardRef}>
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

    // profile component
    const Profile = () => {
        return (
            <div className="flex flex-col gap-4 justify-center m-auto p-4" ref={profileCardRef}>
                <div className="flex flex-row gap-4">
                        <div className="flex-shrink-0">
                            <img
                                className="h-12 w-12 rounded-full"
                                src={user?.photoURL || 'https://via.placeholder.com/150'}
                                alt={user?.displayName!}
                            />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">{user?.displayName}</h1>
                            <p className="text-sm text-gray-400">{user?.email}</p>
                        </div>
                </div>
                <div className="w-full lg:max-w-5xl flex items-center justify-between p-2 shadow-lg gap-4 bg-[#2e2e2e] rounded-md">
                    <p className='text-xs text-[#aaaaaa]'>Points recieved: <span className='text-sm text-white font-bold'>{points}</span></p>
                    <button
                        onClick={() => {
                            triggerNotification('Refreshing points...', 'info');
                            fetchGuessedCards();
                        }}
                        className={`flex items-center justify-center w-6 h-6 rounded-full shadow cursor-pointer bg-[#eeeeee] hover:bg-[#aaaaaa] text-black`}
                        >
                        <FontAwesomeIcon icon={faArrowsRotate} />
                    </button>
                </div>
                {needSubscription ? (
                    <div className='text-sm text-[#aaaaaa]'>
                        <button 
                            className='text-md text-white font-bold underline'
                            onClick={
                                () => {
                                    handleStripe();
                                }}
                                >SUBSCRIBE
                        </button>
                        <span> to get <span className='text-md text-white font-bold italic'>100</span> generations for a month.</span>
                    </div>
                    ) : (
                        <p className='text-sm text-[#aaaaaa]'>Your current plan <span className='text-md text-white font-bold'>USD $10/month</span></p>
                    )
                }
            </div>
        )
    };

    return (
        <header className="flex justify-between items-center p-4 text-white absolute top-4 right-2">
            {/* show notification */}
            {notification && (
                <Notification
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification(null)}
                />
            )}
            {/* show login card as a modal */}
            {showLoginCard && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-[#2e2e2e] rounded-lg shadow-lg max-w-[800px] max-h-[600px] p-2">
                        <Login />
                    </div>
                </div>
            )}
            {/* show profile card as a modal */}
            {showProfile && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-[#2e2e2e] rounded-lg shadow-lg max-w-[800px] max-h-[600px] p-2">
                        <Profile />
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
                            <div className='absolute right-0 mt-6 gap-4 bg-[#2e2e2e] rounded-lg shadow-lg p-2'>
                                <div className="rounded-md shadow-lg z-10">
                                    <button
                                        onClick={() => setShowProfile(true)}
                                        className="block w-full text-white text-center px-4 py-2 hover:bg-[#aaaaaa] hover:text-black rounded-md"
                                    >
                                        Profile
                                    </button>
                                </div>
                                <div className="rounded-md shadow-lg z-10">
                                    <button
                                        onClick={handleLogout}
                                        className="block w-full text-white text-center px-4 py-2 hover:bg-[#aaaaaa] hover:text-black rounded-md"
                                    >
                                        Logout
                                    </button>
                                </div>
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