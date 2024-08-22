import { Timestamp } from "firebase/firestore";

export interface Card {
    imageUrl: string;
    prompt: string;
    createdAt: Timestamp;
}