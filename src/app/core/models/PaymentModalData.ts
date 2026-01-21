export interface PaymentModalData {
  id: string;
  courseName: string;
  isInscription: boolean;
  studentName: string;
  studentDocumentType: string;
  studentDocumentNumber: string;
  coursePrice: string;
  coursePriceNumber: number;
  balance: string;
  balanceNumber: number;
  pendingBalance: string;
  pendingBalanceNumber: number;
  status: string;
  courseId?: string;
  date: string;
  courseImageUrl?: string;

  // Client info added in the modal
  clientName: string;
  clientDocumentType: string;
  clientDocumentNumber: string;
  clientEmail: string;
  clientPhone: string;
}
