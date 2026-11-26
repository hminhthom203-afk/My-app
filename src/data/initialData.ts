import { Character, MusicTrack } from '../types';

export const ADMIN_EMAIL = 'hminhthom203@gmail.com';

export const INTRO_BG_IMAGE = '/src/assets/images/bg_intro_velvet_1795701308762.jpg';

export const PRESET_AVATARS = [
  {
    label: 'Mochi Hoa Hồng',
    url: '/src/assets/images/char_mochi_rose_1795701308646.jpg',
  },
  {
    label: 'Kẹo Bông Mây',
    url: '/src/assets/images/char_cotton_cloud_1795701309948.jpg',
  },
  {
    label: 'Nhung Đỏ Lyly',
    url: '/src/assets/images/char_velvet_lyly_1795701309635.jpg',
  },
  {
    label: 'Sương Mai Đào',
    url: '/src/assets/images/char_sakura_mist_1795701310894.jpg',
  },
];

export const SEED_CHARACTERS: Omit<Character, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'mochi-hoa-hong',
    name: 'Mochi Hoa Hồng',
    avatar: '/src/assets/images/char_mochi_rose_1795701308646.jpg',
    hashtags: ['hoahong', 'tiectra', 'keongot'],
    slogan: 'Mỗi cánh hoa rơi là một viên kẹo ngọt gửi vào giấc mơ.',
    story:
      'Sinh ra từ giọt sương đầu mùa đọng trên đóa hồng nhung cổ điển, Mochi Hoa Hồng là người giữ chìa khóa của Khu Vườn Trà Chiều. Cô nàng thích buộc ruy băng rượu vang lên mái tóc phấn hồng và pha những tách trà ướp hương kẹo dâu cho bất kỳ lữ khách nào lạc bước qua màn sương tím.\n\nMỗi khi có người khẽ cười, những đóa hoa trắng nhỏ quanh cô lại rung rinh phát ra tiếng chuông pha lê dịu nhẹ.',
    link: 'https://ankeohong.example.com/mochi-hoa-hong',
    linkLabel: 'Hồ sơ Khu Vườn Trà Chiều',
    likesCount: 0,
    viewsCount: 0,
  },
  {
    id: 'keo-bong-may',
    name: 'Kẹo Bông Mây',
    avatar: '/src/assets/images/char_cotton_cloud_1795701309948.jpg',
    hashtags: ['denlong', 'hoanghon', 'phepthuat'],
    slogan: 'Thắp sáng bầu trời phấn hồng bằng chiếc đèn lồng đường kéo.',
    story:
      'Chàng pháp sư nhỏ tuổi của Thung Lũng Mây Ngọt luôn mang theo chiếc đèn lồng làm từ đường pha lê hồng. Khi hoàng hôn buông xuống sắc rượu vang, cậu đi dọc những mái nhà ngói cổ để gom các mảnh sao rơi và biến chúng thành những đám mây kẹo bông ấm áp.\n\nÁo choàng nhung thêu chòm sao của cậu được dệt từ ánh trăng và mùi hương hoa mộc lan.',
    link: 'https://ankeohong.example.com/keo-bong-may',
    linkLabel: 'Nhật ký Đèn Lồng Đường',
    likesCount: 0,
    viewsCount: 0,
  },
  {
    id: 'nhung-do-lyly',
    name: 'Nhung Đỏ Lyly',
    avatar: '/src/assets/images/char_velvet_lyly_1795701309635.jpg',
    hashtags: ['nhungdo', 'ngocai', 'huyenao'],
    slogan: 'Khúc ca êm ái giữ lại mùa xuân trong từng nếp lụa.',
    story:
      'Là nghệ sĩ đàn hạc của Nhà Hát Cánh Hoa, Nhung Đỏ Lyly sở hữu giọng hát nhẹ như làn gió thổi qua vườn hồng sớm mai. Tương truyền rằng chỉ cần lắng nghe một điệu valse do cô ngân nga, mọi muộn phiền đều tan biến như bọt đường trong tách sữa ấm.\n\nCô thường đeo chuỗi ngọc trai cổ điển và lưu giữ những bức thư tay chưa từng gửi trong hộp nhạc gỗ hồng.',
    link: 'https://ankeohong.example.com/nhung-do-lyly',
    linkLabel: 'Tuyển tập Giai Điệu Nhung',
    likesCount: 0,
    viewsCount: 0,
  },
  {
    id: 'suong-mai-dao',
    name: 'Sương Mai Đào',
    avatar: '/src/assets/images/char_sakura_mist_1795701310894.jpg',
    hashtags: ['anhdao', 'tinhlinh', 'honnhien'],
    slogan: 'Cười khẽ một cái là cả bầu trời ngập tràn cánh đào bay!',
    story:
      'Tinh linh nhỏ bé nhất trong đại gia đình Ăn Kẹo Hong, Sương Mai Đào luôn đội vòng hoa kem ngà và chạy chân trần trên thảm rêu mềm. Cô bé có tài triệu hồi những cơn gió xuân dịu nhẹ khiến cánh đào và hoa hồng phấn bay phấp phới khắp trang sách.\n\nMón khoái khẩu của Sương Mai Đào là kẹo sữa dâu tây và bánh quy bơ hình ngôi sao.',
    link: 'https://ankeohong.example.com/suong-mai-dao',
    linkLabel: 'Bí mật Rừng Hoa Đào',
    likesCount: 0,
    viewsCount: 0,
  },
];

export const INITIAL_TRACKS: MusicTrack[] = [
  {
    id: 'track-rose-waltz',
    title: 'Vườn Kẹo Hoa Hồng',
    artist: 'Hộp Nhạc Của Kẹo',
    mood: 'Dịu dàng · Valse hộp nhạc',
    durationLabel: 'Vòng lặp êm ái',
    audioUrl: '',
    synthPreset: 'rose_waltz',
  },
  {
    id: 'track-cotton-lullaby',
    title: 'Giấc Mơ Phấn Hồng',
    artist: 'Hộp Nhạc Của Kẹo',
    mood: 'Mơ màng · Chuông pha lê',
    durationLabel: 'Vòng lặp êm ái',
    audioUrl: '',
    synthPreset: 'cotton_lullaby',
  },
  {
    id: 'track-velvet-nocturne',
    title: 'Đêm Nhung Rượu Vang',
    artist: 'Hộp Nhạc Của Kẹo',
    mood: 'Huyền ảo · Đàn hạc ấm',
    durationLabel: 'Vòng lặp êm ái',
    audioUrl: '',
    synthPreset: 'velvet_nocturne',
  },
  {
    id: 'track-petal-breeze',
    title: 'Cánh Hoa Bay Chậm',
    artist: 'Hộp Nhạc Của Kẹo',
    mood: 'Trong trẻo · Gió xuân',
    durationLabel: 'Vòng lặp êm ái',
    audioUrl: '',
    synthPreset: 'petal_breeze',
  },
];
