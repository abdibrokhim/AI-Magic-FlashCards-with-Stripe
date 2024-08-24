'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { initializeApp } from 'firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { User } from 'firebase/auth';
import { firebaseConfig } from '../firebaseConfig';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Notification from '../notify';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(app);

const ResultPage = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const session_id = searchParams.get('session_id');
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState({});
    const [error, setError] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState({ payment_status: '' }); // Default value to avoid undefined errors
    const [notification, setNotification] = useState(null);  // notification message
    const [user, setUser] = useState(null);

    // show notification
    const triggerNotification = (nMessage, nType) => {
        setNotification({ message: nMessage, type: nType });
    };

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

    // fundtion to add user to the firebase database under the subscription collection with the user's email and details
    const addUserToSubscription = async (id, invoice, subscription) => {
        triggerNotification("Activating subscription", "info");
        console.log('user: ', user);
        const currentUser = await getCurrentUser();
        console.log('currentUser: ', currentUser);

        if (!currentUser || !currentUser.email) {
            console.error("User is not logged in or email is missing");
            triggerNotification("User not authenticated", "error");
            return;
        }

        const userEmail = currentUser.email;

        try {
            const createdAt = new Date();
            const expirationDate = new Date(createdAt); // Copy date to prevent mutation
            expirationDate.setMonth(createdAt.getMonth() + 1);

            const userSubscription = {
                email: userEmail,
                id: id,
                invoice: invoice,
                subscription: subscription,
                expirationDate: expirationDate,
                createdAt: createdAt,
            };

            // Use setDoc to create or overwrite a document with userEmail as the ID
            const userDocRef = doc(firestore, 'subscriptions', userEmail);
            await setDoc(userDocRef, userSubscription);

            console.log("User added to subscription collection");
            triggerNotification("Subscription activated", "success");
        } catch (error) {
            console.error("Error adding user to subscription collection", error);
            triggerNotification("Error activating subscription", "error");
        }
    };

    useEffect(() => {
        const fetchCheckoutSession = async () => {
            if (!session_id) return;
            try {
                const res = await fetch(`/api/checkout_sessions?session_id=${session_id}`);
                const sessionData = await res.json();
                if (res.ok) {
                    setSession(sessionData);
                    setPaymentStatus(sessionData.payment_status);
                    console.log('sessionData: ', sessionData);
                    addUserToSubscription(sessionData.id, sessionData.invoice, sessionData.subscription);
                } else {
                    setError(sessionData.error);
                }
            } catch (err) {
                setError('An error occurred while retrieving the session.');
            } finally {
                setLoading(false);
            }
        };
        fetchCheckoutSession();
    }, [session_id]);

    if (loading) {
        return (
            <div className="max-w-sm mx-auto text-center mt-16">
                <div className="flex justify-center">
                    <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full border-[#eeeeee]"></div>
                </div>
                <p className="text-lg mt-4 text-white">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-sm mx-auto text-center mt-16">
                <p className="text-lg text-red-500">{error}</p>
            </div>
        );
    }

    return (
        <div className="max-w-sm mx-auto text-center mt-16 text-white">
            {/* show notification */}
            {notification && (
                <Notification
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification(null)}
                />
            )}
            {paymentStatus === 'paid' ? (
                <>
                    <h1 className="text-2xl font-bold">Thank you for your purchase!</h1>
                    <div className="mt-4">
                        <p className="mt-2">
                            We have received your payment. You will receive an email with the
                            order details shortly.
                        </p>
                    </div>
                    <button 
                        onClick={() => {
                            router.push('/');
                        }} 
                        className="bg-[#eeeeee] hover:bg-[#aaaaaa] text-black p-2 rounded-md w-full font-bold mt-4">
                            <span className='flex justify-center items-center text-black'>Back to main page</span>
                    </button>
                </>
            ) : (
                <>
                    <h1 className="text-2xl font-bold text-white">Payment failed</h1>
                    <div className="mt-4">
                        <p className="mt-2">
                            Your payment was not successful. Please try again.
                        </p>
                    </div>
                    <button 
                        onClick={() => {
                            router.push('/');
                        }} 
                        className="bg-[#eeeeee] hover:bg-[#aaaaaa] text-black p-2 rounded-md w-full font-bold mt-4">
                            <span className='flex justify-center items-center text-black'>Back to main page</span>
                    </button>
                </>
            )}
        </div>
    );
}

export default ResultPage;