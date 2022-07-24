import Base, { Plugin, Options } from './base';
import { MangaStatus } from '~/utils';
import moment from 'moment';
import * as cheerio from 'cheerio';

const options = {
  type: [
    { label: '选择分类', value: Options.Default },
    { label: '冒险', value: '1' },
    { label: '欢乐向', value: '2' },
    { label: '格斗', value: '3' },
    { label: '科幻', value: '4' },
    { label: '爱情', value: '5' },
    { label: '竞技', value: '6' },
    { label: '魔法', value: '7' },
    { label: '校园', value: '8' },
    { label: '悬疑', value: '9' },
    { label: '恐怖', value: '10' },
    { label: '生活亲情', value: '11' },
    { label: '百合', value: '12' },
    { label: '伪娘', value: '13' },
    { label: '耽美', value: '14' },
    { label: '后宫', value: '15' },
    { label: '萌系', value: '16' },
    { label: '治愈', value: '17' },
    { label: '武侠', value: '18' },
    { label: '职场', value: '19' },
    { label: '奇幻', value: '20' },
    { label: '节操', value: '21' },
    { label: '轻小说', value: '22' },
    { label: '搞笑', value: '23' },
  ],
  region: [
    { label: '选择地区', value: Options.Default },
    { label: '日本', value: '1' },
    { label: '内地', value: '2' },
    { label: '欧美', value: '3' },
    { label: '港台', value: '4' },
    { label: '韩国', value: '5' },
    { label: '其他', value: '6' },
  ],
  status: [
    { label: '选择状态', value: Options.Default },
    { label: '连载中', value: '1' },
    { label: '已完结', value: '2' },
  ],
  sort: [
    { label: '添加时间', value: Options.Default },
    { label: '浏览次数', value: '0' },
    { label: '更新时间', value: '1' },
  ],
};

const PATTERN_SEARCH_SCRIPT = /var serchArry=(.*)/;
const PATTERN_INFO_SCRIPT = /initIntroData\((.*)\);/;
const PATTERN_MANGAID_SCRIPT = /var obj_id = "(\d*)";/;
const PATTERN_CHAPTER_SCRIPT = /mReader.initData\(({.*}),/;
const PATTERN_MANGA_TITLE = /\/(.*)\//;

class DongManZhiJia extends Base {
  readonly userAgent =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';

  constructor(pluginID: Plugin, pluginName: string, pluginShortName: string) {
    super(
      pluginID,
      pluginName,
      pluginShortName,
      options.type,
      options.region,
      options.status,
      options.sort
    );
  }

  prepareDiscoveryFetch: Base['prepareDiscoveryFetch'] = (page, type, region, status, sort) => {
    if (type === Options.Default) {
      type = '0';
    }
    if (region === Options.Default) {
      region = '0';
    }
    if (status === Options.Default) {
      status = '0';
    }
    if (sort === Options.Default) {
      sort = '0';
    }

    return {
      url: `https://m.dmzj.com/classify/${type}-0-${status}-${region}-${sort}-${page}.json`,
      headers: new Headers({
        'user-agent': this.userAgent,
      }),
    };
  };
  prepareSearchFetch: Base['prepareSearchFetch'] = (keyword, _page) => {
    return {
      url: `https://m.dmzj.com/search/${keyword}.html`,
      headers: new Headers({
        'user-agent': this.userAgent,
      }),
    };
  };
  prepareMangaInfoFetch: Base['prepareMangaInfoFetch'] = (mangaId) => {
    return {
      url: `https://m.dmzj.com/info/${mangaId}.html`,
      headers: new Headers({
        'user-agent': this.userAgent,
      }),
    };
  };
  prepareChapterListFetch: Base['prepareChapterListFetch'] = () => {};
  prepareChapterFetch: Base['prepareChapterFetch'] = (mangaId, chapterId) => {
    return {
      url: `https://m.dmzj.com/view/${mangaId}/${chapterId}.html`,
      headers: new Headers({
        'user-agent': this.userAgent,
      }),
    };
  };

  handleDiscovery: Base['handleDiscovery'] = (text: string | null) => {
    try {
      const list: any[] = JSON.parse(text || '') || [];

      return {
        discovery: list.map((item) => ({
          href: `https://m.dmzj.com/info/${item.id}.html`,
          hash: Base.combineHash(this.id, item.id),
          source: this.id,
          sourceName: this.name,
          mangaId: item.id,
          cover: `https://images.dmzj.com/${item.cover}`,
          title: item.name,
          latest: '更新至：' + item.last_update_chapter_name,
          updateTime: moment.unix(item.last_updatetime).format('YYYY-MM-DD'),
          author: item.authors,
          tag: item.types,
          status:
            item.status === '连载中'
              ? MangaStatus.Serial
              : item.status === '已完结'
              ? MangaStatus.End
              : MangaStatus.Unknown,
          chapters: [],
        })),
      };
    } catch (error) {
      if (error instanceof Error) {
        return { error };
      } else {
        return { error: new Error('Unknown Error') };
      }
    }
  };

  handleSearch: Base['handleSearch'] = (text: string | null) => {
    try {
      const $ = cheerio.load(text || '');

      const scriptContent = (
        $('script:not([src]):not([type])')
          .toArray()
          .filter((item) => PATTERN_SEARCH_SCRIPT.test((item.children[0] as any).data))[0]
          .children[0] as any
      ).data;
      const [, stringifyData] = scriptContent.match(PATTERN_SEARCH_SCRIPT);

      const list: Manga[] = (JSON.parse(stringifyData.replace(/[\n|\s]/g, '')) || []).map(
        (item: any) => {
          return {
            href: `https://m.dmzj.com/info/${item.id}.html`,
            hash: Base.combineHash(this.id, item.id),
            source: this.id,
            sourceName: this.name,
            mangaId: item.id,
            title: item.name,
            status:
              item.status === '连载中'
                ? MangaStatus.Serial
                : item.status === '已完结'
                ? MangaStatus.End
                : MangaStatus.Unknown,
            cover: `https://images.dmzj.com/${item.cover}`,
            latest: '更新至：' + item.last_update_chapter_name,
            updateTime: moment.unix(item.last_updatetime).format('YYYY-MM-DD'),
            author: item.authors.replaceAll('/', ','),
            tag: item.types.replaceAll('/', ','),
            chapters: [],
          };
        }
      );

      return { search: list };
    } catch (error) {
      if (error instanceof Error) {
        return { error };
      } else {
        return { error: new Error('Unknown Error') };
      }
    }
  };

  handleMangaInfo: Base['handleMangaInfo'] = (text: string | null) => {
    try {
      const $ = cheerio.load(text || '');
      const manga: Manga = {
        href: '',
        hash: '',
        source: this.id,
        sourceName: this.name,
        mangaId: '',
        cover: '',
        title: '',
        latest: '',
        updateTime: '',
        author: '',
        tag: '',
        status: MangaStatus.Unknown,
        chapters: [],
      };

      const chapterScriptContent = (
        $('script:not([src])')
          .toArray()
          .filter((item) => {
            if (item.children.length <= 0) {
              return false;
            }

            return PATTERN_INFO_SCRIPT.test((item.children[0] as any).data);
          })[0].children[0] as any
      ).data;
      const [, stringifyData] = chapterScriptContent.match(PATTERN_INFO_SCRIPT) || [];
      const { title: statusLabel, data }: { title: string; data: any[] } =
        JSON.parse(stringifyData)[0];
      const chapters: ChapterItem[] = data.map((item: any) => ({
        hash: Base.combineHash(this.id, item.comic_id, item.id),
        mangaId: item.comic_id,
        chapterId: item.id,
        href: `https://m.dmzj.com/view/${item.comic_id}/${item.id}.html`,
        title: item.chapter_name,
      }));

      const infoScriptContent = (
        $('script:not([src])')
          .toArray()
          .filter((item) => {
            if (item.children.length <= 0) {
              return false;
            }

            return PATTERN_MANGAID_SCRIPT.test((item.children[0] as any).data);
          })[0].children[0] as any
      ).data;
      const [, mangaId] = infoScriptContent.match(PATTERN_MANGAID_SCRIPT) || [];

      const img: any = $('div.Introduct_Sub div#Cover img').get(0);
      const title = img.attribs.title;
      const cover = img.attribs.src;
      const [text1, text2, , text4] = $('div.Introduct_Sub div.sub_r p.txtItme').toArray();
      const author = text1.children
        .filter((item: any) => item.type === 'tag' && item.name === 'a')
        .map((item: any) => item.children[0].data)
        .join(',');
      const tag = text2.children
        .filter((item: any) => item.type === 'tag' && item.name === 'a')
        .map((item: any) => item.children[0].data)
        .join(',');
      const updateTime = (
        text4.children.filter(
          (item: any) => item.type === 'tag' && item.name === 'span' && item.children.length > 0
        )[0] as any
      ).children[0].data;

      if (statusLabel === '连载') {
        manga.status = MangaStatus.Serial;
      }
      if (statusLabel === '完结') {
        manga.status = MangaStatus.End;
      }

      manga.href = `https://m.dmzj.com/info/${mangaId}.html`;
      manga.mangaId = mangaId;
      manga.hash = Base.combineHash(this.id, mangaId);
      manga.title = title;
      manga.cover = cover;
      manga.latest = '更新至：' + chapters[0].title;
      manga.updateTime = updateTime;
      manga.author = author;
      manga.tag = tag;
      manga.chapters = chapters;

      return { manga };
    } catch (error) {
      if (error instanceof Error) {
        return { error };
      } else {
        return { error: new Error('Unknown Error') };
      }
    }
  };

  handleChapterList: Base['handleChapterList'] = () => {
    return { error: new Error('Plugin DMZJ not support handleChapterList') };
  };

  handleChapter: Base['handleChapter'] = (text: string | null) => {
    try {
      const $ = cheerio.load(text || '');
      const scriptContent = (
        $('script:not([src])')
          .toArray()
          .filter(
            (item) =>
              item.children.length > 0 &&
              PATTERN_CHAPTER_SCRIPT.test((item.children[0] as any).data)
          )[0].children[0] as any
      ).data;
      const [, stringifyData] = scriptContent.match(PATTERN_CHAPTER_SCRIPT) || [];

      const data = JSON.parse(stringifyData);
      const { id, comic_id, folder, chapter_name, page_url } = data;
      const [, name] = folder.match(PATTERN_MANGA_TITLE) || [];

      return {
        chapter: {
          hash: Base.combineHash(this.id, comic_id, id),
          mangaId: comic_id,
          chapterId: id,
          name,
          title: chapter_name,
          headers: {
            Host: 'images.dmzj.com',
            referer: 'https://m.dmzj.com/',
            accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'sec-ch-ua': '".Not/A)Brand";v="99", "Google Chrome";v="103", "Chromium";v="103"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': 'macOS',
            'sec-fetch-dest': 'image',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-site': 'same-site',
            'Cache-control': 'no-store',
            'user-agent': this.userAgent,
          },
          images: page_url.map((item: string) => encodeURI(item)),
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        return { error };
      } else {
        return { error: new Error('Unknown Error') };
      }
    }
  };
}

export default new DongManZhiJia(Plugin.DMZJ, 'dongmanzhijia', 'DMZJ');
