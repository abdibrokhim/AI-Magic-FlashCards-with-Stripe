'use client';

import React, { useState, useRef, useEffect } from 'react';
import { faAdd, faArrowUp, faClose, faCoffee, faRotateRight, faExpand, faWandSparkles, faEye } from '@fortawesome/free-solid-svg-icons';
import { faGithub, faLinkedin, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Image from "next/image";
import OpenAI from "openai";
import { firebaseConfig } from './firebaseConfig';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { Card } from './types';
import Notification from './notify';
import axios from 'axios';
import Header from './header';

const openai = new OpenAI({
  apiKey: "", 
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [data, setData] = useState<Card[]>([]);  // flashcards from firebase database
  const [imageUrl, setImageUrl] = useState<string | null>(''); // image url from firebase storage
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(""); // image url from openai
  const [showGeneratedCard, setShowGeneratedCard] = useState(false);  // show generated card
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' |'info' } | null>(null);  // notification message
  const [refetch, setRefetch] = useState(false);
  const [showExpandedImage, setShowExpandedImage] = useState(false);
  const [expandImageIndex, setExpandImageIndex] = useState<number | null>(null);

  const systemPrompt = `
  `;

  // show notification
  const triggerNotification = (nMessage: string, nType: 'error' | 'success' | 'info') => {
    setNotification({ message: nMessage, type: nType });
  };

  // get flashcards from firebase database
  useEffect(() => {
    const fetchData = async () => {
      setIsFetchingFlashCards(true);
      const querySnapshot = await getDocs(collection(firestore, 'flashcards'));
      const cards: Card[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const food: Card = {
          imageUrl: data.imageUrl,
          prompt: data.prompt,
          createdAt: data.createdAt,
        };
        cards.push(food);
      });
      setData(cards);
      setIsFetchingFlashCards(false);
      console.log("data: ", cards);
    };
    fetchData();
  }, [refetch]);

  // Save flashcard in Firebase Database
  const saveFlashCardInFirebaseDatabase = async (imgUrl: string) => {
    try {
      const docRef = collection(firestore, 'flashcards');
      const createdAt = new Date();
      const newCard = {
        imageUrl: imgUrl,
        prompt: input,
        createdAt: createdAt,
      };
      await setDoc(doc(docRef, createdAt.toISOString()), newCard);
      triggerNotification("Flashcard saved successfully", "success");
      return true;
    } catch (error) {
      console.error("Error saving flashcard: ", error);
      triggerNotification("Error saving flashcard", "error");
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
      if (await saveFlashCardInFirebaseDatabase(imgUrl!)) {
        setShowGeneratedCard(false);
        setInput('');
        setRawImageUrl('');
        setImageUrl(null);
        setRefetch(!refetch);
      }

      if (imageUrl) {
        console.log('Image URL received from Firebase Storage:', imageUrl);
      }
    }
    setIsSavingFlashcard(false);
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerateImage(input);
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
                    setShowExpandedImage(!showExpandedImage)
                    setExpandImageIndex(index);
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full shadow cursor-pointer bg-[#eeeeee] text-black">
                  <FontAwesomeIcon icon={faExpand} />
                </button>
                {/* Guess icon */}
                <button
                  onClick={() => {}}
                  className="flex items-center justify-center w-10 h-10 rounded-full shadow cursor-pointer bg-[#eeeeee] text-black">
                  <FontAwesomeIcon icon={faWandSparkles} />
                </button>
                {/* Prompt icon */}
                <button
                  onClick={() => {}}
                  className="flex items-center justify-center w-10 h-10 rounded-full shadow cursor-pointer bg-[#eeeeee] text-black">
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
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
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
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="">
            <Image src={data[expandImageIndex!].imageUrl} width={600} height={600} alt="Generated image" className="rounded-md" />
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
          disabled={isGeneratingImage || input === ''}
          onClick={() => handleGenerateImage(input)}
          className={`flex items-center justify-center w-10 h-10 rounded-full shadow ${
            isGeneratingImage || input === '' ? 'cursor-not-allowed bg-[#4e4e4e] text-black'  : 'cursor-pointer bg-[#eeeeee] text-black'}`}
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
