import axios from 'axios';

const TEST_USER_ID = '4wCtOfZuvMHPmNVgIUMCDxL6BbE5sjIB';
const START_DATE = '2025-09-16T00:00:00Z';
const END_DATE = '2025-09-16T00:00:00Z';

const ALL_QUERIES = [
  'active-competitors',
  'sources-coverage',
  'posts-analyzed',
  'mentions-trend',
  'sentiment-trend',
  'competitor-sentiment',
  'share-of-voice',
  'net-sentiment-score',
  'top-complaints',
  'complaint-trend',
  'complaint-heatmap',
  'emerging-complaints',
  'top-alternatives',
  'alternatives-trend',
  'switching-intent-trend',
  'complaints-alternatives-correlation',
  'leads-over-time',
  'lead-status-funnel',
  'lead-source-breakdown',
  'recent-switching-leads',
  'last-scraped',
  'total-mentions',
  'negative-sentiment-percentage',
  'recurring-complaints',
  'alternatives-mentioned',
  'recent-negative-mentions',
  'complaint-examples',
  'alternatives-by-competitor'
];

async function testQueries() {
  console.log('Testing all queries...\n');

  // Test queries one by one
  for (const query of ALL_QUERIES) {
    try {
      console.log(`Testing query: ${query}`);
      const response = await axios.post('http://localhost:3000/cards', {
        queries: [query],
        user_id: TEST_USER_ID,
        start_date: START_DATE,
        end_date: END_DATE
      });

      if (response.data.success) {
        console.log('✅ Success:', JSON.stringify(response.data.data[0].data.length), 'rows\n');
      } else {
        console.log('❌ Failed:', response.data.error, '\n');
      }
    } catch (error: any) {
      console.log('❌ Error:', error.response?.data?.error || error.message, '\n');
    }
  }

  // Test all queries at once
  try {
    console.log('Testing all queries in one request...');
    const response = await axios.post('http://localhost:3000/cards', {
      queries: ALL_QUERIES,
      user_id: TEST_USER_ID,
      start_date: START_DATE,
      end_date: END_DATE
    });

    if (response.data.success) {
      console.log('✅ All queries successful\n');
    } else {
      console.log('❌ Batch request failed:', response.data.error, '\n');
    }
  } catch (error: any) {
    console.log('❌ Batch request error:', error.response?.data?.error || error.message, '\n');
  }
}

// Run the tests
testQueries().catch(console.error);
