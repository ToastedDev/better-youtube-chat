import { installPageBridge } from '@/lib/page-bridge';

export default defineContentScript({
  matches: ['https://www.youtube.com/live_chat*'],
  allFrames: true,
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installPageBridge();
  },
});
