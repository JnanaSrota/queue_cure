export interface Token {
  tokenNumber: number;
  patientName: string;
  phoneNumber?: string;
  status: "waiting" | "in-progress" | "done" | "no-show";
  createdAt: string; // ISO String
  calledAt?: string; // ISO String
  completedAt?: string; // ISO String
  estimatedWaitMinutes?: number; // Computed live
}

export interface Queue {
  doctorId: string;
  doctorName: string;
  avgConsultationTimeMinutes: number;
  currentTokenNumber: number | null;
  tokens: Token[];
  nextTokenNumber: number;
}
