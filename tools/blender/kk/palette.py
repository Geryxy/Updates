"""Színek és stílusok: frakciók, évszakok, közös anyagok."""
from .core import mat, shade

OWNERS = ('szikra', 'moha', 'vaskapu', 'volgyek', 'neutral')
SEASONS = ('spring', 'summer', 'autumn', 'winter')

# Frakcióstílusok. A zászló színe megegyezik a játékbeli frakciószínnel.
STYLES = {
    # Szikra Liga: homokkő, terrakotta és arany – kereskedővárosok
    'szikra': dict(flag='#e8b23a', roof='#b5562a', roof2='#d49a2e', stone='#b3a281', keep='#a49372',
                   plaster='#e2d2ac', cloth='#e6d6a4', wood='#6b4a2a', special='dome'),
    # Mohazöld Szövetség: fa és mohazöld zsindely – erdei települések
    'moha': dict(flag='#58a84f', roof='#3f6a34', roof2='#5d7a3a', stone='#8a8068', keep='#7b745f',
                 plaster='#cbbd96', cloth='#c2cfa0', wood='#5a3f22', special='grove'),
    # Vaskapu Korona: sötét kő és pala – erődvárosok
    'vaskapu': dict(flag='#c2483f', roof='#34363f', roof2='#5a2b28', stone='#74747a', keep='#62626a',
                    plaster='#b9b1a4', cloth='#b9a8a4', wood='#4a3626', special='bastion'),
    # Szabad Völgyek: világos kő és kék tetők – nyitott, lovas települések
    'volgyek': dict(flag='#4f8fd8', roof='#3b62a3', roof2='#6f97d1', stone='#c2beb3', keep='#b0aca2',
                    plaster='#ebe5d5', cloth='#d8e1ef', wood='#6a4c2e', special='spire'),
    # Függetlenek: zsúp és fa
    'neutral': dict(flag='#9a9488', roof='#9a8548', roof2='#7c6c3c', stone='#8c8270', keep='#7f786a',
                    plaster='#cfc3a3', cloth='#c9bfa6', wood='#5c4326', special=None),
}


class Mats:
    """Egy frakció anyagkészlete (az azonos paraméterű anyagok közösek)."""

    def __init__(self, owner, snow=0.0):
        st = STYLES[owner]
        self.owner = owner
        self.special = st['special']
        self.stone = mat(st['stone'], scale=5, bump=0.5, snow=snow)
        self.keep = mat(st['keep'], scale=4, bump=0.5, snow=snow)
        self.roof = mat(st['roof'], rough=0.65, scale=14, bump=0.3, snow=snow)
        self.roof2 = mat(st['roof2'], rough=0.65, scale=14, bump=0.3, snow=snow)
        self.plaster = mat(st['plaster'], scale=8, snow=snow)
        self.wood = mat(st['wood'], scale=10, noise=0.22, snow=snow)
        self.cloth = mat(st['cloth'], rough=0.8, scale=5, noise=0.1, snow=snow)
        self.flag = mat(st['flag'], rough=0.7, scale=3, noise=0.1)
        self.flag_dark = mat(shade(st['flag'], 0.6), rough=0.7, scale=3, noise=0.1)
        self.thatch = mat('#a08a4a', rough=1.0, scale=16, bump=0.5, snow=snow)
        self.dark = mat('#20170e', noise=0)
        self.iron = mat('#4a4c52', rough=0.5, metallic=0.8, noise=0.08)
        self.gold = mat('#e8b23a', rough=0.35, metallic=0.9, noise=0)
        self.glow = mat('#ffcf70', emit='#ffb850', strength=9.0, noise=0)
        self.fire = mat('#ff9a3a', emit='#ff7a1e', strength=22.0, noise=0)
        self.straw = mat('#c9ac55', rough=1.0, scale=18, bump=0.4, snow=snow)
        self.rock = mat('#6a6a70', scale=4, bump=0.7, snow=snow)


# Lombszínek évszakonként: (tűlevelű, lombos változatok)
LEAVES = {
    'spring': ('#245c33', ['#4f9a45', '#63ad4c', '#3f8a3c']),
    'summer': ('#1d4f2c', ['#35783a', '#447f2e', '#2f6c3c']),
    'autumn': ('#22512e', ['#c0621f', '#d99a2b', '#a3402a', '#c98a2b']),
    'winter': ('#27493c', ['#5b6b62']),
}
# A talaj színe évszakonként (a játék festett talajához igazítva), tereptípusonként.
GROUND = {
    'plains': {'spring': '#5d8a3a', 'summer': '#66862f', 'autumn': '#7d6c2c', 'winter': '#aab7bf'},
    'forest': {'spring': '#365a2b', 'summer': '#2d5024', 'autumn': '#55411e', 'winter': '#8a9aa3'},
    'hills': {'spring': '#73763c', 'summer': '#7a6f32', 'autumn': '#7c5e2e', 'winter': '#a0acb3'},
    'mountain': {'spring': '#5c5858', 'summer': '#625b57', 'autumn': '#615349', 'winter': '#97a2ab'},
    'swamp': {'spring': '#3c5340', 'summer': '#384a39', 'autumn': '#4a472d', 'winter': '#7b8c8e'},
}
DIRT = {'spring': '#6b5236', 'summer': '#705638', 'autumn': '#66492e', 'winter': '#8f8a84'}
