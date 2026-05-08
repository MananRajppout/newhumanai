import 'dotenv/config';
import { AccessToken } from 'livekit-server-sdk';

async function test() {
  console.log('--- LiveKit credential smoke test ---');
  console.log('URL:    ', process.env.LIVEKIT_URL);
  console.log('Key:    ', process.env.LIVEKIT_API_KEY);
  console.log('Secret: ', process.env.LIVEKIT_API_SECRET ? `${process.env.LIVEKIT_API_SECRET.slice(0, 6)}...${process.env.LIVEKIT_API_SECRET.slice(-4)}` : '(missing)');

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    console.error('❌ Missing key or secret');
    process.exit(1);
  }

  try {
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: 'smoketest-user',
      ttl: '15m',
      metadata: JSON.stringify({ trigger: 'smoketest', context: 'verifying credentials' }),
    });
    at.addGrant({
      roomJoin: true,
      room: 'smoketest-room',
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    console.log('\n✅ Token minted successfully');
    console.log('   Length:', token.length, 'chars');

    // Decode the JWT payload to verify it looks right
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    console.log('\n   Decoded payload:');
    console.log('   - iss (key):     ', payload.iss);
    console.log('   - sub (identity):', payload.sub);
    console.log('   - exp (expires): ', new Date(payload.exp * 1000).toISOString());
    console.log('   - room:          ', payload.video?.room);
    console.log('   - canPublish:    ', payload.video?.canPublish);
    console.log('   - canSubscribe:  ', payload.video?.canSubscribe);

    if (payload.iss !== process.env.LIVEKIT_API_KEY) {
      console.error('\n❌ Token issuer does not match API key');
      process.exit(1);
    }

    console.log('\n✅ All checks passed. Backend can mint tokens for this LiveKit project.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Token minting failed:', err.message);
    process.exit(1);
  }
}

test();
