/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ReactNode } from 'react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coffee, 
  User as UserIcon, 
  LogOut, 
  Settings, 
  History, 
  ShoppingCart, 
  CheckCircle, 
  Clock, 
  Plus, 
  Minus,
  ChevronRight,
  AlertCircle,
  QrCode,
  LayoutDashboard,
  Trash2
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { UserProfile, Machine, Order, OrderItem } from './types';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Error Boundary ---

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let message = "Something went wrong.";
      try {
        const errInfo = JSON.parse(error.message);
        message = `Firestore Error: ${errInfo.operationType} at ${errInfo.path || 'unknown path'}. ${errInfo.error}`;
      } catch (e) {
        message = error.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-coffee-cream p-6 text-center">
          <div className="coffee-card bg-white max-w-md space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold">Oops!</h2>
            <p className="text-coffee-brown/60 text-sm">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-coffee-accent text-white py-2 px-6 rounded-xl font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Components ---

const Auth = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onLogin(result.user);
    } catch (error) {
      console.error("Login Error:", error);
      toast.error("Failed to login. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-coffee-gradient p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-8 rounded-[2.5rem] w-full max-w-md text-center"
      >
        <div className="bg-coffee-accent w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Coffee className="text-white w-10 h-10" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">USET COFFEE</h1>
        <p className="text-coffee-cream/80 mb-8">Premium coffee for smart students.</p>
        
        <button 
          onClick={handleLogin}
          className="w-full bg-white text-coffee-brown font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-coffee-cream transition-colors shadow-lg"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>
      </motion.div>
    </div>
  );
};

const Dashboard = ({ userProfile, machines, onOrderNow }: { userProfile: UserProfile, machines: Machine[], onOrderNow: (machine: Machine) => void }) => {
  return (
    <div className="p-6 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-coffee-brown">Welcome to USET COFFEE APP ☕</h2>
          <p className="text-coffee-brown/60">Hello, {userProfile.displayName.split(' ')[0]}</p>
        </div>
      </header>

      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-coffee-accent" />
          Available Machines
        </h3>
        <div className="grid gap-4">
          {machines.map((machine) => (
            <motion.div 
              key={machine.id}
              whileTap={{ scale: 0.98 }}
              className="coffee-card bg-white flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${machine.status === 'Available' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                <div>
                  <h4 className="font-bold text-lg">{machine.name}</h4>
                  <p className="text-sm text-coffee-brown/60">{machine.location}</p>
                </div>
              </div>
              <button 
                onClick={() => machine.status === 'Available' && onOrderNow(machine)}
                disabled={machine.status !== 'Available'}
                className={`py-2 px-6 rounded-xl font-bold transition-all ${
                  machine.status === 'Available' 
                  ? 'bg-coffee-accent text-white shadow-md hover:shadow-lg' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {machine.status === 'Available' ? 'Order Now' : 'Busy'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Menu = ({ machine, onBack, onCheckout }: { machine: Machine, onBack: () => void, onCheckout: (items: OrderItem[]) => void }) => {
  const [cart, setCart] = useState<{ [key: string]: number }>({
    "Simple Coffee": 0,
    "Coffee with Milk": 0
  });

  const products = [
    { name: "Simple Coffee", price: 10, icon: <Coffee className="w-6 h-6" /> },
    { name: "Coffee with Milk", price: 25, icon: <Coffee className="w-6 h-6" /> }
  ];

  const updateQuantity = (name: string, delta: number) => {
    setCart(prev => ({
      ...prev,
      [name]: Math.max(0, prev[name] + delta)
    }));
  };

  const totalItems: number = (Object.values(cart) as number[]).reduce((a: number, b: number) => a + b, 0);
  const totalPrice: number = products.reduce((sum: number, p) => sum + (p.price * cart[p.name]), 0);

  return (
    <div className="p-6 space-y-8">
      <button onClick={onBack} className="text-coffee-brown/60 flex items-center gap-1">
        <ChevronRight className="w-5 h-5 rotate-180" /> Back to Dashboard
      </button>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Select Your Coffee</h2>
        <p className="text-coffee-brown/60">Ordering from: <span className="font-bold text-coffee-accent">{machine.name}</span></p>
      </div>

      <div className="space-y-4">
        {products.map((product) => (
          <div key={product.name} className="coffee-card bg-white flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-coffee-cream w-12 h-12 rounded-2xl flex items-center justify-center text-coffee-accent">
                {product.icon}
              </div>
              <div>
                <h4 className="font-bold text-lg">{product.name}</h4>
                <p className="text-coffee-accent font-bold">D{product.price.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => updateQuantity(product.name, -1)}
                className="w-8 h-8 rounded-full border-2 border-coffee-gold flex items-center justify-center text-coffee-gold hover:bg-coffee-gold hover:text-white transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-bold text-lg w-4 text-center">{cart[product.name]}</span>
              <button 
                onClick={() => updateQuantity(product.name, 1)}
                className="w-8 h-8 rounded-full bg-coffee-gold flex items-center justify-center text-white hover:bg-coffee-brown transition-colors shadow-md"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalItems > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-6 left-6 right-6 glass p-6 rounded-[2rem] flex items-center justify-between shadow-2xl"
        >
          <div>
            <p className="text-white/60 text-sm">Total Price</p>
            <p className="text-white text-2xl font-bold text-coffee-accent">D{totalPrice.toFixed(2)}</p>
          </div>
          <button 
            onClick={() => {
              const items = products
                .filter(p => cart[p.name] > 0)
                .map(p => ({ name: p.name, price: p.price, quantity: cart[p.name] }));
              onCheckout(items);
            }}
            className="bg-coffee-accent text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-2 shadow-lg hover:scale-105 transition-transform"
          >
            Checkout <ShoppingCart className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </div>
  );
};

const Checkout = ({ items, machine, onBack, onPlaceOrder }: { items: OrderItem[], machine: Machine, onBack: () => void, onPlaceOrder: (pickupTime: string, paymentMethod: 'Wave' | 'Cash') => void }) => {
  const [pickupTime, setPickupTime] = useState("As soon as possible");
  const [paymentMethod, setPaymentMethod] = useState<'Wave' | 'Cash'>('Wave');
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const times = ["As soon as possible", "In 5 minutes", "In 10 minutes", "In 15 minutes"];

  return (
    <div className="p-6 space-y-8">
      <button onClick={onBack} className="text-coffee-brown/60 flex items-center gap-1">
        <ChevronRight className="w-5 h-5 rotate-180" /> Back to Menu
      </button>

      <h2 className="text-3xl font-bold">Checkout</h2>

      <div className="coffee-card bg-white space-y-4">
        <h3 className="font-bold text-lg border-b pb-2">Order Summary</h3>
        {items.map((item) => (
          <div key={item.name} className="flex justify-between items-center">
            <p className="text-coffee-brown/80">{item.quantity}x {item.name}</p>
            <p className="font-bold">D{(item.price * item.quantity).toFixed(2)}</p>
          </div>
        ))}
        <div className="flex justify-between items-center pt-2 border-t text-xl font-bold text-coffee-accent">
          <p>Total</p>
          <p>D{totalPrice.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-coffee-accent" />
          Pickup Time
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {times.map((time) => (
            <button 
              key={time}
              onClick={() => setPickupTime(time)}
              className={`p-4 rounded-2xl text-sm font-bold transition-all border-2 ${
                pickupTime === time 
                ? 'bg-coffee-accent border-coffee-accent text-white shadow-md' 
                : 'bg-white border-coffee-cream text-coffee-brown/60'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-coffee-accent" />
          Payment Method
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setPaymentMethod('Wave')}
            className={`p-4 rounded-2xl text-sm font-bold transition-all border-2 flex flex-col items-center gap-2 ${
              paymentMethod === 'Wave' 
              ? 'bg-coffee-accent border-coffee-accent text-white shadow-md' 
              : 'bg-white border-coffee-cream text-coffee-brown/60'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'Wave' ? 'bg-white text-coffee-accent' : 'bg-coffee-cream text-coffee-accent'}`}>
              <span className="font-black text-xs">W</span>
            </div>
            Pay with Wave
          </button>
          <button 
            onClick={() => setPaymentMethod('Cash')}
            className={`p-4 rounded-2xl text-sm font-bold transition-all border-2 flex flex-col items-center gap-2 ${
              paymentMethod === 'Cash' 
              ? 'bg-coffee-accent border-coffee-accent text-white shadow-md' 
              : 'bg-white border-coffee-cream text-coffee-brown/60'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'Cash' ? 'bg-white text-coffee-accent' : 'bg-coffee-cream text-coffee-accent'}`}>
              <span className="font-black text-xs">D</span>
            </div>
            Pay at Machine
          </button>
        </div>
      </div>

      <button 
        onClick={() => onPlaceOrder(pickupTime, paymentMethod)}
        className="w-full bg-coffee-brown text-white font-bold py-5 rounded-[2rem] text-xl shadow-xl hover:bg-black transition-colors flex items-center justify-center gap-3"
      >
        {paymentMethod === 'Wave' ? 'Pay & Place Order' : 'Place Order'} <CheckCircle className="w-6 h-6" />
      </button>
    </div>
  );
};

const OrderTracking = ({ order, onBack }: { order: Order, onBack: () => void }) => {
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateWavePayment = async () => {
    setIsSimulating(true);
    toast.loading("Verifying Wave payment...");
    
    try {
      const response = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.orderNumber })
      });
      const data = await response.json();
      
      if (data.paid) {
        toast.dismiss();
        toast.success("Payment Verified! Dispense code generated.");
        
        // Update order status in Firestore with the unique dispense code
        await updateDoc(doc(db, 'orders', order.id), { 
          paymentStatus: 'Paid',
          dispenseCode: data.dispenseCode,
          status: 'Preparing'
        });

        // Simulate machine "accepting" the code after 2 seconds
        setTimeout(async () => {
          toast.info("Machine accepted code. Preparing coffee...");
          await updateDoc(doc(db, 'orders', order.id), { 
            status: 'Ready'
          });
        }, 3000);
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Payment verification failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="p-6 space-y-8 flex flex-col items-center text-center">
      <button onClick={onBack} className="self-start text-coffee-brown/60 flex items-center gap-1">
        <ChevronRight className="w-5 h-5 rotate-180" /> Back to Home
      </button>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Order Tracking</h2>
        <p className="text-coffee-brown/60">Order #{order.orderNumber}</p>
      </div>

      <div className="relative w-48 h-48 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-4 border-dashed border-coffee-accent rounded-full"
        />
        <div className="bg-white w-40 h-40 rounded-full shadow-2xl flex flex-col items-center justify-center p-4">
          {order.status === 'Preparing' ? (
            <>
              <Clock className="w-12 h-12 text-coffee-accent mb-2 animate-pulse" />
              <p className="font-bold text-coffee-accent">Preparing...</p>
            </>
          ) : (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
              <p className="font-bold text-green-500 text-lg">Ready!</p>
            </>
          )}
        </div>
      </div>

      <div className="coffee-card bg-white w-full space-y-4">
        <div className="flex justify-between items-center text-sm border-b pb-2">
          <span className="text-coffee-brown/60">Payment Status:</span>
          <span className={`font-bold ${order.paymentStatus === 'Paid' ? 'text-green-500' : 'text-coffee-accent'}`}>
            {order.paymentStatus} ({order.paymentMethod})
          </span>
        </div>

        {order.paymentMethod === 'Wave' && order.paymentStatus === 'Pending' ? (
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 p-6 rounded-3xl border-2 border-blue-200 flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-blue-500">
                <QrCode className="w-32 h-32 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="font-bold text-blue-800">Scan Wave QR to Pay</p>
                <p className="text-xs text-blue-600">Machine will receive a unique code after payment</p>
              </div>
              <button 
                onClick={simulateWavePayment}
                disabled={isSimulating}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSimulating ? 'Verifying...' : 'Simulate Wave Scan'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {order.dispenseCode ? (
              <div className="bg-coffee-cream p-6 rounded-3xl border-2 border-coffee-accent/20">
                <p className="text-xs text-coffee-brown/60 uppercase tracking-widest mb-2 font-bold">Dispense Code</p>
                <div className="bg-white py-4 px-6 rounded-2xl border-2 border-coffee-accent shadow-inner">
                  <span className="text-3xl font-black text-coffee-brown tracking-tighter">{order.dispenseCode}</span>
                </div>
                <p className="text-[10px] text-coffee-brown/40 mt-3 italic">This code has been sent to the machine for preparation.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-coffee-accent font-bold py-4">
                  <QrCode className="w-6 h-6" />
                  <span>Scan at Machine to Dispense</span>
                </div>
                <div className="bg-coffee-cream p-8 rounded-2xl flex items-center justify-center">
                  <div className="w-32 h-32 bg-coffee-brown rounded-lg flex items-center justify-center text-white font-mono text-2xl">
                    {order.orderNumber}
                  </div>
                </div>
                <p className="text-sm text-coffee-brown/60 italic">Show this code to the machine sensor to collect your coffee.</p>
              </>
            )}
          </div>
        )}
      </div>

      {order.status === 'Ready' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 p-6 rounded-3xl border-2 border-green-200 w-full"
        >
          <p className="text-green-800 font-bold">Machine Activated!</p>
          <p className="text-green-600 text-sm">Please collect your coffee from the dispenser.</p>
        </motion.div>
      )}
    </div>
  );
};

const OrderHistory = ({ orders, onReorder, onClearHistory }: { 
  orders: Order[], 
  onReorder: (order: Order) => void,
  onClearHistory: () => void 
}) => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6 text-coffee-accent" />
          Order History
        </h2>
        {orders.length > 0 && (
          <button 
            onClick={() => {
              if (window.confirm("Are you sure you want to clear your entire order history?")) {
                onClearHistory();
              }
            }}
            className="text-red-500 p-2 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold"
          >
            <Trash2 className="w-4 h-4" /> Clear All
          </button>
        )}
      </div>
      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-coffee-brown/40">
            <Coffee className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No orders yet. Time for coffee?</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="coffee-card bg-white space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-coffee-brown/60">
                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()}
                  </p>
                  <p className="font-bold">Order #{order.orderNumber}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  order.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-coffee-cream text-coffee-accent'
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="text-sm text-coffee-brown/80">
                {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <p className="font-bold text-coffee-accent">D{order.totalPrice.toFixed(2)}</p>
                <button 
                  onClick={() => onReorder(order)}
                  className="text-coffee-brown font-bold text-sm flex items-center gap-1 hover:text-coffee-accent"
                >
                  Reorder <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({ machines, orders, onUpdateMachine, onUpdateOrder, onAddMachine }: { 
  machines: Machine[], 
  orders: Order[], 
  onUpdateMachine: (id: string, status: 'Available' | 'Busy') => void,
  onUpdateOrder: (id: string, status: 'Preparing' | 'Ready' | 'Completed') => void,
  onAddMachine: (name: string, location: string) => void
}) => {
  const [tab, setTab] = useState<'machines' | 'orders'>('machines');

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6 text-coffee-accent" />
        Admin Panel
      </h2>

      <div className="flex bg-white rounded-2xl p-1 shadow-inner">
        <button 
          onClick={() => setTab('machines')}
          className={`flex-1 py-3 rounded-xl font-bold transition-all ${tab === 'machines' ? 'bg-coffee-accent text-white shadow-md' : 'text-coffee-brown/60'}`}
        >
          Machines
        </button>
        <button 
          onClick={() => setTab('orders')}
          className={`flex-1 py-3 rounded-xl font-bold transition-all ${tab === 'orders' ? 'bg-coffee-accent text-white shadow-md' : 'text-coffee-brown/60'}`}
        >
          Orders
        </button>
      </div>

      {tab === 'machines' ? (
        <div className="space-y-4">
          <div className="bg-coffee-cream p-4 rounded-3xl border-2 border-dashed border-coffee-accent/30 space-y-3">
            <h4 className="font-bold text-sm text-coffee-brown/60 uppercase tracking-widest">Add New Machine</h4>
            <div className="flex gap-2">
              <input 
                id="new-machine-name"
                placeholder="Machine Name"
                className="flex-1 bg-white border-none rounded-xl p-3 text-sm outline-none shadow-sm"
              />
              <input 
                id="new-machine-location"
                placeholder="Location"
                className="flex-1 bg-white border-none rounded-xl p-3 text-sm outline-none shadow-sm"
              />
              <button 
                onClick={() => {
                  const nameInput = document.getElementById('new-machine-name') as HTMLInputElement;
                  const locInput = document.getElementById('new-machine-location') as HTMLInputElement;
                  if (nameInput.value && locInput.value) {
                    onAddMachine(nameInput.value, locInput.value);
                    nameInput.value = '';
                    locInput.value = '';
                  }
                }}
                className="bg-coffee-accent text-white p-3 rounded-xl shadow-md"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
          {machines.map(m => (
            <div key={m.id} className="coffee-card bg-white flex items-center justify-between">
              <div>
                <h4 className="font-bold">{m.name}</h4>
                <p className="text-sm text-coffee-brown/60">{m.location}</p>
              </div>
              <select 
                value={m.status}
                onChange={(e) => onUpdateMachine(m.id, e.target.value as any)}
                className="bg-coffee-cream border-none rounded-xl p-2 font-bold text-sm outline-none"
              >
                <option value="Available">Available</option>
                <option value="Busy">Busy</option>
              </select>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(o => (
            <div key={o.id} className="coffee-card bg-white space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">#{o.orderNumber}</p>
                  <p className="text-xs text-coffee-brown/60">{o.userId.slice(0, 8)}...</p>
                </div>
                <select 
                  value={o.status}
                  onChange={(e) => onUpdateOrder(o.id, e.target.value as any)}
                  className="bg-coffee-cream border-none rounded-xl p-2 font-bold text-xs outline-none"
                >
                  <option value="Preparing">Preparing</option>
                  <option value="Ready">Ready</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="text-sm">
                {o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'menu' | 'checkout' | 'tracking' | 'history' | 'admin'>('dashboard');
  
  const [machines, setMachines] = useState<Machine[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          try {
            const newProfile: UserProfile = {
              uid: authUser.uid,
              email: authUser.email || '',
              displayName: authUser.displayName || 'Student',
              role: authUser.email === 'chamlamin693@gmail.com' ? 'admin' : 'student',
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', authUser.uid), newProfile);
            setUserProfile(newProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${authUser.uid}`);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for machines
    const qMachines = query(collection(db, 'machines'));
    const unsubMachines = onSnapshot(qMachines, (snapshot) => {
      const mList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Machine));
      setMachines(mList);
      
      // Seed machines if empty
      if (mList.length === 0 && userProfile?.role === 'admin') {
        addDoc(collection(db, 'machines'), {
          name: 'USET Coffee Machine #1',
          status: 'Available',
          location: 'Main Hall'
        });
      }
    });

    // Listen for orders
    const qOrders = userProfile?.role === 'admin' 
      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const oList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(oList);
      
      // Find active order for tracking
      const active = oList.find(o => o.status === 'Preparing' || o.status === 'Ready');
      if (active) setActiveOrder(active);
      else setActiveOrder(null);
    });

    return () => {
      unsubMachines();
      unsubOrders();
    };
  }, [user, userProfile]);

  const handlePlaceOrder = async (pickupTime: string, paymentMethod: 'Wave' | 'Cash') => {
    if (!user || !selectedMachine) return;

    const orderNumber = Math.floor(1000 + Math.random() * 9000).toString();
    const totalPrice = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
      if (paymentMethod === 'Wave') {
        toast.info("Order created. Please scan the Wave QR on the next screen.");
      }

      const newOrder: Omit<Order, 'id'> = {
        userId: user.uid,
        machineId: selectedMachine.id,
        items: cartItems,
        totalPrice,
        pickupTime,
        status: 'Preparing',
        paymentStatus: 'Pending', // Always pending until scanned/paid
        paymentMethod,
        orderNumber,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), newOrder);
      
      // Update machine status
      await updateDoc(doc(db, 'machines', selectedMachine.id), { status: 'Busy' });

      toast.success("Order placed successfully!");
      setView('tracking');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
  };

  const updateMachineStatus = async (id: string, status: 'Available' | 'Busy') => {
    try {
      await updateDoc(doc(db, 'machines', id), { status });
      toast.success("Machine updated");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `machines/${id}`);
    }
  };

  const updateOrderStatus = async (id: string, status: 'Preparing' | 'Ready' | 'Completed') => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      
      // If completed, free up the machine (simplified logic)
      if (status === 'Completed') {
        const order = orders.find(o => o.id === id);
        if (order) {
          await updateDoc(doc(db, 'machines', order.machineId), { status: 'Available' });
        }
      }
      toast.success("Order updated");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const addMachine = async (name: string, location: string) => {
    try {
      await addDoc(collection(db, 'machines'), {
        name,
        location,
        status: 'Available'
      });
      toast.success("Machine added successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'machines');
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    const userOrders = orders.filter(o => o.userId === user.uid);
    
    toast.loading("Clearing history...");
    try {
      const deletePromises = userOrders.map(o => deleteDoc(doc(db, 'orders', o.id)));
      await Promise.all(deletePromises);
      toast.dismiss();
      toast.success("History cleared!");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'orders');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-coffee-gradient flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Coffee className="text-white w-12 h-12" />
        </motion.div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-coffee-cream pb-24 max-w-md mx-auto relative shadow-2xl overflow-hidden">
        <Toaster position="top-center" richColors />
        
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {view === 'dashboard' && (
              <Dashboard 
                userProfile={userProfile} 
                machines={machines} 
                onOrderNow={(m) => { setSelectedMachine(m); setView('menu'); }} 
              />
            )}
            {view === 'menu' && selectedMachine && (
              <Menu 
                machine={selectedMachine} 
                onBack={() => setView('dashboard')} 
                onCheckout={(items) => { setCartItems(items); setView('checkout'); }} 
              />
            )}
            {view === 'checkout' && selectedMachine && (
              <Checkout 
                items={cartItems} 
                machine={selectedMachine} 
                onBack={() => setView('menu')} 
                onPlaceOrder={handlePlaceOrder} 
              />
            )}
            {view === 'tracking' && activeOrder && (
              <OrderTracking order={activeOrder} onBack={() => setView('dashboard')} />
            )}
            {view === 'history' && (
              <OrderHistory 
                orders={orders.filter(o => o.userId === user.uid)} 
                onReorder={(o) => { 
                  const machine = machines.find(m => m.id === o.machineId);
                  if (machine && machine.status === 'Available') {
                    setSelectedMachine(machine);
                    setCartItems(o.items);
                    setView('checkout');
                  } else {
                    toast.error("Machine is currently busy or unavailable.");
                  }
                }} 
                onClearHistory={clearHistory}
              />
            )}
            {view === 'admin' && userProfile.role === 'admin' && (
              <AdminPanel 
                machines={machines} 
                orders={orders} 
                onUpdateMachine={updateMachineStatus}
                onUpdateOrder={updateOrderStatus}
                onAddMachine={addMachine}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-coffee-cream px-6 py-4 flex justify-between items-center z-50">
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard />} label="Home" />
          <NavButton active={view === 'tracking'} onClick={() => activeOrder ? setView('tracking') : toast.info("No active order")} icon={<Clock />} label="Status" />
          <NavButton active={view === 'history'} onClick={() => setView('history')} icon={<History />} label="History" />
          {userProfile.role === 'admin' ? (
            <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<Settings />} label="Admin" />
          ) : (
            <NavButton active={false} onClick={() => signOut(auth)} icon={<LogOut />} label="Logout" />
          )}
        </nav>
      </div>
    </ErrorBoundary>
  );
}

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-coffee-accent' : 'text-coffee-brown/40'}`}
  >
    <div className={`p-2 rounded-xl transition-all ${active ? 'bg-coffee-cream' : ''}`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);
