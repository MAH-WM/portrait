export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
  
  res.status(200).json({
    webhookUrl: process.env.ZAPIER_WEBHOOK_URL
  });
}
