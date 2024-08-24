'use client';

import React, { useState, useRef, useEffect } from 'react';
import { faAdd, faArrowUp, faClose, faCoffee, faRotateRight, faExpand, faWandSparkles, faEye, faCopy } from '@fortawesome/free-solid-svg-icons';
import { faGithub, faLinkedin, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Image from "next/image";
import OpenAI from "openai";
import { firebaseConfig, auth } from './firebaseConfig';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { Card, GuessedCard } from './types';
import Notification from './notify';
import axios from 'axios';
import Header from './header';
import { onAuthStateChanged } from 'firebase/auth';
import { User } from 'firebase/auth';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_openaiApiKey, 
  dangerouslyAllowBrowser: true
});

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const storage = getStorage(app);

export default function Home() {
  const sampleData = [
    {imageUrl: "https://firebasestorage.googleapis.com/v0/b/chatwithpdf-30e42.appspot.com/o/images%2F309.JPG?alt=media&token=bd92fbfd-edd4-4fb4-b8f5-3cff8cb0d9d7", prompt: "a cup of coffee a cup of coffee"},
    {imageUrl: "https://firebasestorage.googleapis.com/v0/b/chatwithpdf-30e42.appspot.com/o/images%2F309.JPG?alt=media&token=bd92fbfd-edd4-4fb4-b8f5-3cff8cb0d9d7", prompt: "a cup of coffee a cup of coffee a cup of coffee a cup of coffee a cup of coffee"},
    {imageUrl: "https://firebasestorage.googleapis.com/v0/b/chatwithpdf-30e42.appspot.com/o/images%2F309.JPG?alt=media&token=bd92fbfd-edd4-4fb4-b8f5-3cff8cb0d9d7", prompt: "a cup of coffee a cup of coffee a cup of coffee"},
    {imageUrl: "https://firebasestorage.googleapis.com/v0/b/chatwithpdf-30e42.appspot.com/o/images%2F309.JPG?alt=media&token=bd92fbfd-edd4-4fb4-b8f5-3cff8cb0d9d7", prompt: "a cup of coffee a cup of coffee a cup of coffee"},
    {imageUrl: "https://firebasestorage.googleapis.com/v0/b/chatwithpdf-30e42.appspot.com/o/images%2F309.JPG?alt=media&token=bd92fbfd-edd4-4fb4-b8f5-3cff8cb0d9d7", prompt: "a cup of coffee a cup of coffee a cup of coffee"},
  ]
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);  // loading state for image generation
  const [isSavingFlashcard, setIsSavingFlashcard] = useState(false);  // loading state for saving flashcard
  const [isFetchingFlashCards, setIsFetchingFlashCards] = useState(true);  // loading state for fetching flashcards
  const [input, setInput] = useState('');  // user input
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const guessTextareaRef = useRef<HTMLDivElement | null>(null);
  const promptTextareaRef = useRef<HTMLDivElement | null>(null);
  const pointTextareaRef = useRef<HTMLDivElement | null>(null);
  const expandRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<Card[]>([]);  // flashcards from firebase database
  const [guessedCards, setGuessedCards] = useState<GuessedCard[]>([]);  // guessed cards from firebase database
  const [guessedCard, setGuessedCard] = useState<GuessedCard>();  // guessed cards from firebase database
  const [imageUrl, setImageUrl] = useState<string | null>(''); // image url from firebase storage
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(""); // image url from openai
  const [showGeneratedCard, setShowGeneratedCard] = useState(false);  // show generated card
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' |'info' } | null>(null);  // notification message
  const [refetch, setRefetch] = useState(false);
  const [showExpandedImage, setShowExpandedImage] = useState(false);
  const [expandImageIndex, setExpandImageIndex] = useState<number | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [guessMode, setGuessMode] = useState(false);
  const [showPromptMode, setShowPromptMode] = useState(false);
  const [inputGuess, setInputGuess] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [showPointMode, setShowPointMode] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showPointCard, setShowPointCard] = useState(false);

  // Close the expanded image if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: any) => {
        if (expandRef.current && !expandRef.current.contains(event.target)) {
          setShowExpandedImage(false);
        }
        if (guessTextareaRef.current && !guessTextareaRef.current.contains(event.target as Node)) {
          setGuessMode(false);
        }
        if (promptTextareaRef.current && !promptTextareaRef.current.contains(event.target as Node)) {
          setShowPromptMode(false);
        }
        if (pointTextareaRef.current && !pointTextareaRef.current.contains(event.target as Node)) {
          setShowPointMode(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const systemPrompt = `
  You will be given a original prompt and user guess. In the following format: [original prompt]\n<original prompt goes here> \n[user guess]\n<user guess goes here>.
  You need to evaluate the user guess relative to the original prompt. 
  You should determine how close user guess is to the original prompt in a scale of 0% to 100%. 
  You MUST only return a single number. The number should be a percentage value. 
  For example, if the user guess is 50% similar to the original prompt, you should return ONLY 50.
  `;

  const compareUserInputWithPrompt = async (userInput: string, prompt: string) => {
    console.log("comparing user guess...");
    setIsComparing(true);
    triggerNotification('We are comparing your guess...', 'info');
    const fullPrompt = `
    [original prompt]\n${prompt}\n[user guess]\n${userInput}
    `;
    const completion = await openai.chat.completions.create({
      messages: [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": fullPrompt},
        ],
      model: "gpt-4o-mini",
    });
    console.log('response form gpt', completion.choices[0].message.content);
    const g = parseInt(completion.choices[0].message.content!);
    setGrade(g);
    saveGuessedCardInFirebaseDatabase(g);
  };

  // save user guessed card in firebase database under guessedCards collection with the same id as the original card
  const saveGuessedCardInFirebaseDatabase = async (grade: number) => {
    console.log("saving guessed card in firebase database...");
    triggerNotification('We are saving your guessed card...', 'info');
    
    // Ensure user is authenticated and get the user's email
    const user = auth.currentUser;
    if (!user || !user.email) {
        console.error("User is not logged in or email is missing");
        triggerNotification("User not authenticated", "error");
        return;
    }
    
    const userEmail = user.email;
    const imgUrl = data[expandImageIndex!].imageUrl;
    const prompt = data[expandImageIndex!].prompt;
    const guess = inputGuess;

    try {
        // Reference to the user's document in 'guessedCards' collection
        const userDocRef = doc(firestore, 'guessedCards', userEmail);
        
        // Reference to the 'cards' subcollection within the user's document
        const cardsCollectionRef = collection(userDocRef, 'cards');
        
        const createdAt = new Date();
        const newCard = {
            id: data[expandImageIndex!].id,
            imageUrl: imgUrl,
            prompt: prompt,
            guess: guess,
            grade: grade,
            point: grade/10,
            createdAt: createdAt,
        };

        // Add the new card to the 'cards' subcollection
        await setDoc(doc(cardsCollectionRef), newCard);

        triggerNotification("Guessed card saved successfully", "success");
        setIsComparing(false);
        setShowPointCard(true);
        return true;
    } catch (error) {
        console.error("Error saving guessed card: ", error);
        triggerNotification("Error saving guessed card", "error");
        return false;
    }
  };

  // show notification
  const triggerNotification = (nMessage: string, nType: 'error' | 'success' | 'info') => {
    setNotification({ message: nMessage, type: nType });
  };

  const fetchAllCards = async () => {
    setIsFetchingFlashCards(true);
    const querySnapshot = await getDocs(collection(firestore, 'flashcards'));
    const cards: Card[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const card: Card = {
        id: doc.id,
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        createdAt: data.createdAt,
      };
      cards.push(card);
    });
    setData(cards);
    setIsFetchingFlashCards(false);
    console.log("data: ", cards);
  };

  // get flashcards from firebase database
  useEffect(() => {
    fetchAllCards();
  }, [refetch]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
    });

    return () => unsubscribe();
}, [user]);

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
    setGuessedCards(cards);
    console.log("guessed cards: ", cards);
  };
  // get guessed cards from firebase database
  useEffect(() => {
    console.log("fetching guessed cards...");
    console.log("user: ", user);
    console.log("user email: ", user?.email);
    fetchGuessedCards();
  }, [user, refetch]);

  // fetch userCards from firebase database and return length of the cards
  const fetchUserCards = async () => {
    if (!user || !user.email) {
      console.error("User is not logged in or email is missing");
      triggerNotification("User not authenticated", "error");
      return;
    }
    const userEmail = user.email;
    const querySnapshot = await getDocs(collection(firestore, 'userCards', userEmail, 'cards'));
    const cards: Card[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const card: Card = {
        id: data.id,
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        createdAt: data.createdAt,
      };
      cards.push(card);
    });
    console.log("user cards: ", cards);
    return cards.length;
  };

  // useEffect(() => {
  //   console.log("fetching user cards...");
  //   console.log("user: ", user);
  //   console.log("user email: ", user?.email);
  //   fetchUserCards();
  // }, [user, refetch]);

  // Save flashcard in Firebase Database
  const saveFlashCardInFirebaseDatabase = async (imgUrl: string) => {
    try {
      // Reference to the 'flashcards' collection
      const flashcardsCollectionRef = collection(firestore, 'flashcards');
      
      const createdAt = new Date();
      const newCard = {
        imageUrl: imgUrl,
        prompt: input,  // Make sure 'input' is defined and contains the prompt
        createdAt: createdAt,
      };
  
      // Add a new document to the 'flashcards' collection with auto-generated ID
      const docRef = await addDoc(flashcardsCollectionRef, newCard);
      
      triggerNotification("Flashcard saved successfully", "success");
      
      // Return the generated document ID
      const docId = docRef.id;
      console.log('Generated Document ID:', docId);
      return docId;
    } catch (error) {
      console.error("Error saving flashcard: ", error);
      triggerNotification("Error saving flashcard", "error");
      return null; // Return null in case of an error
    }
  };

  const uploadImageToFirebaseStorage = async (blob: Blob) => {
    try {
      const storageRef = ref(storage, `images/${Date.now()}.jpg`);
      // Upload the Blob to Firebase Storage
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      // Get the download URL of the uploaded image
      const uploadedImageUrl = await getDownloadURL(storageRef);
      setImageUrl(uploadedImageUrl);
      // Optionally, set the image URL in your state or handle it further
      console.log('Image uploaded successfully:', uploadedImageUrl);
      // Trigger a notification for success
      triggerNotification('Image uploaded successfully', 'success');

      return uploadedImageUrl;
    } catch (error) {
      console.error('Error uploading image: ', error);
      triggerNotification('Error uploading image', 'error');
    }
  };

  // generate image from prompt
  const handleGenerateImage = async (prompt: string) => {
    triggerNotification('We are generating your image...', 'info');
    console.log("generating image...");
    setIsGeneratingImage(true);
    console.log('prompt: ', prompt);
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });
    const image_url = response.data[0].url;
    if (image_url) {
      console.log('openai image_url: ', rawImageUrl);
      setRawImageUrl(image_url);
      setShowGeneratedCard(true);
    }
    setIsGeneratingImage(false);
  };

  const downloadImageAsBlob = async (imageUrl: string): Promise<Blob> => {
    const proxyUrl = `https://cors-anywhere.herokuapp.com/${imageUrl}`;
    const response = await axios.get(proxyUrl, { responseType: 'blob' });
    return response.data;
  };
  
  const saveFlashCard = async () => {
    triggerNotification('We are saving your flashcard...', 'info');
    console.log("saving flashcard...");
    setIsSavingFlashcard(true);
    if (rawImageUrl) {
      console.log('Image URL received from OpenAI:', rawImageUrl);

      // Download the image as a Blob
      const imageBlob = await downloadImageAsBlob(rawImageUrl);

      // Upload the downloaded Blob to Firebase Storage
      console.log("uplaoding image to firebase storage...");
      console.log('openai image_url: ', rawImageUrl);
      const imgUrl = await uploadImageToFirebaseStorage(imageBlob);

      console.log("saving flashcard in firebase database...");
      const cardId = await saveFlashCardInFirebaseDatabase(imgUrl!)
      if (cardId) {
        // save card id in userCards collection
        if(await saveUserCardIdsInFirebaseDatabase(cardId)) {
          setShowGeneratedCard(false);
          setInput('');
          setRawImageUrl('');
          setImageUrl(null);
          setRefetch(!refetch);
        }
      }
      if (imageUrl) {
        console.log('Image URL received from Firebase Storage:', imageUrl);
      }
    }
    setIsSavingFlashcard(false);
  };

  // save only ids of user generated cards in firebase database under userCards collection
  const saveUserCardIdsInFirebaseDatabase = async (cardId: string) => {
    console.log("saving user card ids in firebase database...");
    triggerNotification('We are saving your card...', 'info');
    // Ensure user is authenticated and get the user's email
    const user = auth.currentUser;
    if (!user || !user.email) {
      console.error("User is not logged in or email is missing");
      triggerNotification("User not authenticated", "error");
      return;
    }
    const userEmail = user.email;
    try {
      // Reference to the user's document in 'userCards' collection
      const userDocRef = doc(firestore, 'userCards', userEmail);
      
      // Reference to the 'cards' subcollection within the user's document
      const cardsCollectionRef = collection(userDocRef, 'cards');
      
      const createdAt = new Date();
      const newCard = {
          id: cardId,
          createdAt: createdAt,
      };

      // Add the new card to the 'cards' subcollection
      await setDoc(doc(cardsCollectionRef), newCard);

      triggerNotification("Card saved successfully", "success");
      return true;
    } catch (error) {
      console.error("Error saving card: ", error);
      triggerNotification("Error saving card", "error");
      return false;
    }
  };

  const handleKeyDown = async (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const cLen = await fetchUserCards();
      if (cLen! < 0) {
        handleGenerateImage(input)
      } else {
        triggerNotification('You have reached the limit of 10 cards', 'error');
      }
    }
  };

  const handleInput = (e: any) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // for guess mode
  const handleGuessInput = (e: any) => {
    setInputGuess(e.target.value);
    adjustGuessTextareaHeight();
  };

  const adjustGuessTextareaHeight = () => {
    const textarea = guessTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  };

  useEffect(() => {
    adjustGuessTextareaHeight();
  }, [inputGuess]);

  const loader = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
      <circle cx={4} cy={12} r={3} fill="currentColor">
        <animate id="svgSpinners3DotsScale0" attributeName="r" begin="0;svgSpinners3DotsScale1.end-0.25s" dur="0.75s" values="3;.2;3" />
      </circle>
      <circle cx={12} cy={12} r={3} fill="currentColor">
        <animate attributeName="r" begin="svgSpinners3DotsScale0.end-0.6s" dur="0.75s" values="3;.2;3" />
      </circle>
      <circle cx={20} cy={12} r={3} fill="currentColor">
        <animate id="svgSpinners3DotsScale1" attributeName="r" begin="svgSpinners3DotsScale0.end-0.45s" dur="0.75s" values="3;.2;3" />
      </circle>
    </svg>
  );

  const FlashCards = () => {
    return (
      <div className="flex flex-row gap-4 flex-wrap justify-center m-auto pb-12">
        {data.map((card, index) => (
          <div key={index} className="relative bg-[#2e2e2e] shadow-lg rounded-md p-2 group">
            {/* Overlay and buttons (visible on hover) */}
            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-md">
              <div className="flex gap-4">
                {/* Expand icon */}
                <button
                  onClick={() => {
                    setExpandImageIndex(index);
                    setShowExpandedImage(!showExpandedImage)
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full shadow cursor-pointer bg-[#eeeeee] text-black hover:bg-[#aaaaaa]">
                  <FontAwesomeIcon icon={faExpand} />
                </button>
                {/* Guess icon */}
                <button
                  onClick={() => {
                    setExpandImageIndex(index);
                    const cardId = data[index!].id;
                    console.log('cardId: ', cardId);
                    const cond = guessedCards.map((card) => card.id).includes(cardId)
                    console.log('cond: ', cond);
                    if (cond && user !== null) {
                      setShowPointMode(!showPointMode);
                      setGuessedCard(guessedCards.filter((card) => card.id === cardId)[0]);
                    } else {
                      setGuessMode(!guessMode);
                    }
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full shadow cursor-pointer bg-[#eeeeee] text-black hover:bg-[#aaaaaa]">
                  <FontAwesomeIcon icon={faWandSparkles} />
                </button>
                {/* Prompt icon */}
                <button
                  onClick={() => {
                    setExpandImageIndex(index);
                    // delay 2 seconds to allow the textarea to render
                    setShowPromptMode(!showPromptMode);
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full shadow cursor-pointer bg-[#eeeeee] text-black hover:bg-[#aaaaaa]">
                  <FontAwesomeIcon icon={faEye} />
                </button>
              </div>
            </div>
            {/* Image */}
            <Image src={card.imageUrl} width={256} height={256} alt="Generated image" className="rounded-md" />
          </div>
        ))}
      </div>
    );
  };

  // card component with generated image and prompt, and save button. top right corner has close button
  // card has light gray background and shadow. image located at the left side and prompt at the right side (use row flex with gap 4). below the prompt, there is a save button (use col flex with gap 4)
  const GeneratedCard = ({ imageUrl, prompt, onClose, onSave }: { imageUrl: string; prompt: string; onClose: () => void; onSave: () => void; }) => {
    return (
      <div className="relative flex flex-col gap-4 p-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`flex items-center justify-center w-10 h-10 rounded-full shadow cursor-pointer bg-[#eeeeee] text-black absolute top-2 right-2`}>
            {!isSavingFlashcard 
              ? <FontAwesomeIcon icon={faClose} />
              : <span className='flex justify-center items-center text-black'>{loader()}</span>
            }
        </button>
        {/* Content */}
        <div className="flex gap-4">
          {/* Image Section */}
          <div className="w-3/5">
            <Image src={imageUrl} width={256} height={256} alt="Generated image" className="rounded-md" />
          </div>
  
          {/* Prompt and Save Button Section */}
          <div className="w-2/5 flex flex-col gap-4 pt-12">
            <p className="text-white">{prompt}</p>
            <button 
              disabled={isSavingFlashcard}
              onClick={onSave} 
              className="bg-[#eeeeee] text-black p-2 rounded-md w-full font-bold">
              {!isSavingFlashcard 
                ? <span className='flex justify-center items-center text-black'>Save</span>
                : <span className='flex justify-center items-center text-black'>{loader()}</span>
              }
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 relative">
      {/* show header */}
      <Header />
      {/* show notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
      {/* show flashcards */}
      {/* use sampleData */}
      <FlashCards />
      {/* show generated card as a modal */}
      {showGeneratedCard && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div className="bg-[#2e2e2e] rounded-lg shadow-lg max-w-[800px] max-h-[600px] p-2">
            <GeneratedCard
              imageUrl={rawImageUrl!}
              prompt={input}
              onClose={() => setShowGeneratedCard(!showGeneratedCard)}
              onSave={saveFlashCard}
            />
          </div>
        </div>
      )}
      {/* show expanded image */}
      {showExpandedImage && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div ref={expandRef} className="">
            <Image src={data[expandImageIndex!].imageUrl} width={600} height={600} alt="Generated image" className="rounded-md" />
          </div>
        </div>
      )}
      {/* show geuss mode */}
      {guessMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div ref={guessTextareaRef} className="flex flex-col gap-4">
            <Image src={data[expandImageIndex!].imageUrl} width={600} height={600} alt="Generated image" className="rounded-md" />
            {/* show input for user guess */}
            <div className="w-full lg:max-w-5xl mx-auto flex items-center p-2 mb-8 shadow-lg gap-4 bg-[#2e2e2e] rounded-md">
              <textarea
                tabIndex={0}
                className="flex-1 resize-none border-none focus:ring-0 outline-none bg-transparent text-white p-2"
                placeholder="Type your message..."
                value={inputGuess}
                onChange={handleGuessInput}
                onKeyDown={handleKeyDown}
                style={{ minHeight: '24px', maxHeight: '128px' }}
              />
              <button
                disabled={isComparing || user === null || inputGuess === ''}
                onClick={() => {
                  compareUserInputWithPrompt(inputGuess, data[expandImageIndex!].prompt);
                }}
                className={`flex items-center justify-center w-8 h-8 mr-2 rounded-full shadow ${
                  isComparing || inputGuess === '' || user === null ? 'cursor-not-allowed bg-[#4e4e4e] text-black'  : 'cursor-pointer bg-[#eeeeee] text-black'}`}
              >
                {!isComparing 
                  ? <FontAwesomeIcon icon={faArrowUp} />
                  : <span className='flex justify-center items-center text-white'>{loader()}</span>
                }
              </button>
            </div>
          </div>
        </div>
      )}
      {/* show point card after user guess */}
      {showPointCard && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div className="bg-[#2e2e2e] rounded-lg shadow-lg max-w-[300px] max-h-[600px] p-2">
            <div className="flex flex-col gap-2 items-center justify-center">
              <p className='text-sm text-[#aaaaaa]'>Points recieved</p>
              {/* <p className='text-lg text-white font-bold'>{grade}</p> */}
              <p className='text-[42px] text-white font-bold'>{grade!/10}</p>
              <div className="w-full lg:max-w-5xl flex items-center justify-between p-2 shadow-lg bg-[#2e2e2e] rounded-md">
                <p className='text-sm text-white'>It means your <span className='text-md text-white font-bold'>Geussed Prompt</span> was <span className='text-md text-white font-bold underline'>60%</span> near to <span className='text-md text-white font-bold'>Actual Prompt</span></p>
              </div>
              <div className="rounded-md shadow-lg z-10 w-full">
                <button
                    onClick={() => {
                      setShowPointCard(false);
                      setGuessMode(false);
                      fetchAllCards();
                      fetchGuessedCards();
                      setInputGuess('');
                    }}
                    className="block w-full text-black bg-[#eeeeee] text-center px-4 py-2 hover:bg-[#aaaaaa] hover:text-black rounded-md"
                >
                    Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* show prompt mode */}
      {showPromptMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div ref={promptTextareaRef} className="flex flex-col gap-4">
            <Image src={data[expandImageIndex!].imageUrl} width={600} height={600} alt="Generated image" className="rounded-md" />
            {/* show original prompt */}
            <div className="w-full lg:max-w-5xl flex items-center p-2 mb-8 shadow-lg gap-4 bg-[#2e2e2e] rounded-md">
              <p className='flex-1 max-w-[500px] resize-none border-none focus:ring-0 outline-none bg-transparent text-white p-2'>{data[expandImageIndex!].prompt}</p>
              <button
                onClick={() => {
                  // copy to clipboard
                  navigator.clipboard.writeText(data[expandImageIndex!].prompt);
                  triggerNotification('Prompt copied to clipboard', 'success');
                }}
                className={`flex items-center justify-center w-8 h-8 rounded-full shadow cursor-pointer bg-[#eeeeee] hover:bg-[#aaaaaa] text-black`}
              >
                <FontAwesomeIcon icon={faCopy} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* show point mode when user already tried to guess the flashcard */}
      {showPointMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <div ref={pointTextareaRef} className="flex flex-col gap-4 max-w-4xl items-center justify-center">
            <Image src={guessedCard!.imageUrl} width={600} height={600} alt="Generated image" className="rounded-md" />
            {/* show original prompt */}
            <div className='flex flex-row gap-4 w-full'>
              <div className="w-full mx-auto flex items-center justify-between p-2 mb-8 shadow-lg gap-4 bg-[#2e2e2e] rounded-md">
                <div className='flex flex-col flex-1'>
                  <p className='text-xs text-[#aaaaaa]'>Actual prompt</p>
                  <p className='flex-1 resize-none border-none focus:ring-0 outline-none bg-transparent text-white p-2'>{guessedCard!.prompt}</p>
                </div>
                <button
                  onClick={() => {
                    // copy to clipboard
                    navigator.clipboard.writeText(guessedCard!.prompt);
                    triggerNotification('Prompt copied to clipboard', 'success');
                  }}
                  className={`flex items-center justify-center w-8 h-8 mr-2 rounded-full shadow cursor-pointer bg-[#eeeeee] hover:bg-[#aaaaaa] text-black`}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </button>
              </div>
              <div className="w-full mx-auto flex items-center justify-between p-2 mb-8 shadow-lg gap-4 bg-[#2e2e2e] rounded-md">
                <div className='flex flex-col flex-1'>
                  <p className='text-xs text-[#aaaaaa]'>Your guess</p>
                  <p className='flex-1 resize-none border-none focus:ring-0 outline-none bg-transparent text-white p-2'>{guessedCard!.guess}</p>
                  <p className='text-xs text-[#aaaaaa]'>Points recieved: <span className='text-sm text-white font-bold'>{guessedCard!.point}</span></p>
                </div>
                <button
                  onClick={() => {
                    // copy to clipboard
                    navigator.clipboard.writeText(guessedCard!.guess);
                    triggerNotification('Prompt copied to clipboard', 'success');
                  }}
                  className={`flex items-center justify-center w-8 h-8 mr-2 rounded-full shadow cursor-pointer bg-[#eeeeee] hover:bg-[#aaaaaa] text-black`}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* show input field */}
      <div className="w-[80%] lg:max-w-5xl mx-auto flex items-center p-2 mb-8 fixed bottom-0 left-0 right-0 shadow-lg gap-4 bg-[#2e2e2e] rounded-md">
        <textarea
          tabIndex={0}
          ref={textareaRef}
          className="flex-1 resize-none border-none focus:ring-0 outline-none bg-transparent text-white p-2"
          placeholder="Type your message..."
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          style={{ minHeight: '24px', maxHeight: '128px' }}
        />
        <button
          disabled={isGeneratingImage || input === '' || user === null}
          onClick={async () => {
            const cLen = await fetchUserCards();
            if (cLen! < 0) {
              handleGenerateImage(input)
            } else {
              triggerNotification('You have reached the limit of 10 cards', 'error');
            }
          }}
          className={`flex items-center justify-center w-10 h-10 rounded-full shadow ${
            isGeneratingImage || input === '' || user === null ? 'cursor-not-allowed bg-[#4e4e4e] text-black'  : 'cursor-pointer bg-[#eeeeee] text-black'}`}
        >
          {!isGeneratingImage 
            ? <FontAwesomeIcon icon={faArrowUp} />
            : <span className='flex justify-center items-center text-white'>{loader()}</span>
          }
        </button>
      </div>
    </main>
  );
}
