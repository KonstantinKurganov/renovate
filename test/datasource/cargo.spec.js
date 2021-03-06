const fs = require('fs');

const got = require('../../lib/util/got');
const { getPkgReleases } = require('../../lib/datasource/cargo');

let res1 = fs.readFileSync('test/datasource/cargo/_fixtures/libc.json', 'utf8');
res1 = JSON.parse(res1);
let res2 = fs.readFileSync(
  'test/datasource/cargo/_fixtures/amethyst.json',
  'utf8'
);
res2 = JSON.parse(res2);

jest.mock('../../lib/util/got');

describe('datasource/cargo', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      global.repoCache = {};
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getPkgReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for missing fields', async () => {
      got.mockReturnValueOnce({ crate: {} });
      expect(
        await getPkgReleases({ lookupName: 'non_existent_crate' })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(await getPkgReleases({ lookupName: 'some_crate' })).toBeNull();
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      let e;
      try {
        await getPkgReleases({ lookupName: 'some_crate' });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(await getPkgReleases('some_crate')).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res1,
      });
      const res = await getPkgReleases({ lookupName: 'libc' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: res2,
      });
      const res = await getPkgReleases({ lookupName: 'amethyst' });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });
  });
});
