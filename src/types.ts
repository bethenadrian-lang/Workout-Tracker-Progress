export interface WorkoutLog {
  id: string;
  userId?: string;
  date: string;
  ex: string;
  kg: number;
  sets: number;
  reps: number;
  rpe: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExerciseItem {
  n: string;
  g: string;
  t: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  token: string;
  expiresAt: number;
}
