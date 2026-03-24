export type UserRole = 'student' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: any;
}

export interface Machine {
  id: string;
  name: string;
  status: 'Available' | 'Busy';
  location: string;
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  machineId: string;
  items: OrderItem[];
  totalPrice: number;
  pickupTime: string;
  status: 'Preparing' | 'Ready' | 'Completed';
  paymentStatus: 'Pending' | 'Paid' | 'Failed';
  paymentMethod: 'Wave' | 'Cash';
  orderNumber: string;
  dispenseCode?: string;
  createdAt: any;
}
