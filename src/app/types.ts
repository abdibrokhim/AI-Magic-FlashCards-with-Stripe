import { Timestamp } from "firebase/firestore";

export interface Card {
    id: string;
    imageUrl: string;
    prompt: string;
    createdAt: Timestamp;
}