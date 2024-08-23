import { Timestamp } from "firebase/firestore";

export interface Card {
    id: string;
    imageUrl: string;
    prompt: string;
    createdAt: Timestamp;
}

export interface GuessedCard {
    id: string;
    imageUrl: string;
    prompt: string;
    guess: string;
    grade: number;
    point: number;
    createdAt: Timestamp;
}