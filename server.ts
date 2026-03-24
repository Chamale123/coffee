import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Wave Payment API (Mock/Simulation) ---
  // In a real scenario, you'd use Wave's Checkout API: 
  // https://api.wave.com/v1/checkout/sessions
  
  app.post("/api/payment/wave", async (req, res) => {
    const { amount, orderId, userId } = req.body;
    
    // In a real app, you'd call Wave's API here with your WAVE_API_KEY
    // const response = await axios.post('https://api.wave.com/v1/checkout/sessions', {
    //   amount,
    //   currency: 'XOF', // or your local currency
    //   error_url: `${process.env.APP_URL}/payment/error`,
    //   success_url: `${process.env.APP_URL}/payment/success?orderId=${orderId}`,
    //   client_reference_id: orderId
    // }, {
    //   headers: { 'Authorization': `Bearer ${process.env.WAVE_API_KEY}` }
    // });
    
    // For this demo, we'll simulate a successful session creation
    // and return a mock checkout URL.
    
    console.log(`Initializing Wave payment for Order: ${orderId}, Amount: ${amount}`);
    
    // Simulate a short delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real app, this would be the Wave checkout URL
    const mockCheckoutUrl = `https://wave.com/pay/mock-session-${Math.random().toString(36).substring(7)}?amount=${amount}&orderId=${orderId}`;
    
    res.json({ 
      checkout_url: mockCheckoutUrl,
      qr_code_data: `wave-pay-${orderId}-${amount}`,
      session_id: `wave_sess_${Math.random().toString(36).substring(7)}`
    });
  });

  app.post("/api/payment/verify", async (req, res) => {
    const { orderId } = req.body;
    // Simulate verifying with Wave servers
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate a unique 6-digit dispense code
    const dispenseCode = `COFFEE-${Math.floor(100000 + Math.random() * 900000)}`;
    
    res.json({ 
      status: "success", 
      paid: true,
      dispenseCode
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
