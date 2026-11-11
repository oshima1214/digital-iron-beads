import app from '../../app.json';
import { BEADS_EXT, BEADS_MIME, BEADS_UTI, BUNDLE_ID } from './appIdentity';

// アプリ ID を変えるとき（M6）に、app.json と片方だけ変え忘れないための確認
test('app.json bundle id and document type match appIdentity', () => {
  const ios = app.expo.ios;
  expect(ios.bundleIdentifier).toBe(BUNDLE_ID);
  const exported = ios.infoPlist.UTExportedTypeDeclarations[0];
  expect(exported.UTTypeIdentifier).toBe(BEADS_UTI);
  expect(exported.UTTypeTagSpecification['public.filename-extension']).toEqual([BEADS_EXT]);
  expect(exported.UTTypeTagSpecification['public.mime-type']).toEqual([BEADS_MIME]);
  expect(ios.infoPlist.CFBundleDocumentTypes[0].LSItemContentTypes).toEqual([BEADS_UTI]);
});
