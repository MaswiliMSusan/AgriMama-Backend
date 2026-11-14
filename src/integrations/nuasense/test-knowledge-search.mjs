
import 'dotenv/config';
import { searchAgriMamaKnowledge } from '../../services/ai/knowledgeSearch.js';

const query = 'MAIZE_PD_014';

async function runTest() {
  console.log('\n========================================');
  console.log('AgriMama Knowledge Retrieval Test');
  console.log('========================================');

  console.log('\nQuery:', query);
  console.log('\nSearching the AgriMama knowledge base...\n');

  try {
    const result = await searchAgriMamaKnowledge(query, 5);

    console.log('SEARCH COMPLETED');

    console.log('\nTop-level response keys:');
    console.log(Object.keys(result ?? {}));

    console.log('\nFULL SEARCH RESPONSE:');
    console.dir(result, {
      depth: null,
      colors: true,
      maxArrayLength: null
    });

    const results =
      result?.data ??
      result?.results ??
      result?.matches;

    if (Array.isArray(results)) {
      console.log(`\nRetrieved result count: ${results.length}`);

      results.forEach((item, index) => {
        console.log(`\n--- Retrieved item ${index + 1} ---`);

        console.dir(item, {
          depth: null,
          colors: true,
          maxArrayLength: null
        });
      });
    } else {
      console.log(
        '\nNo data/results/matches array was found at the top level.'
      );

      console.log(
        'Please share the full response above so we can inspect its structure.'
      );
    }
  } catch (error) {
    console.error('\nKNOWLEDGE SEARCH FAILED');

    console.error(
      error?.stack || error?.message || error
    );

    process.exitCode = 1;
  }
}

runTest();
