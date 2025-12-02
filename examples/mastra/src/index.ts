import 'dotenv/config';
import { mastra } from './mastra/index.js';

async function main() {
  const agent = mastra.getAgent('weatherAgent');

  if (!agent) {
    console.error('Weather agent not found');
    process.exit(1);
  }

  // Get query from command line args or use default
  const query = process.argv.slice(2).join(' ') || 'What is the weather in San Francisco?';

  console.log(`\n🌤️  Weather Agent\n${'='.repeat(60)}\n`);
  console.log(`Query: ${query}\n`);

  try {
    // Stream the agent's response
    const response = await agent.stream([
      {
        role: 'user',
        content: query,
      },
    ]);

    console.log('Agent Response:\n');

    // Print the streamed text to terminal
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
    }

    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  // Wait for traces to be exported
  console.log('⏳ Waiting for traces to be exported...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced from 6s
  console.log('✅ Traces sent to TCC\n');
}

main();
