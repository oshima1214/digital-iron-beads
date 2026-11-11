#Part1
# デジタルアイロンビーズ - 完全修正版
# Google Colab + ngrok用

# ============================================
# セル1: ライブラリのインストールとフォント設定
# ============================================

# ライブラリのインストール
!pip install gradio opencv-python-headless pillow numpy pyngrok -q

# 日本語フォントのインストール（重要！）
!apt-get install -y fonts-noto-cjk > /dev/null 2>&1

# ngrokの設定
from pyngrok import ngrok
ngrok.set_auth_token("YOUR_NGROK_TOKEN_HERE")  # ここにトークンを入力

# インポート
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import gradio as gr
import io
import base64
import os
import tempfile
from datetime import datetime

# ============================================
# IronBeadsApp クラス定義
# ============================================

class IronBeadsApp:
    def __init__(self):
        self.disp_w, self.disp_h = 930, 930
        
        # 状態変数
        self.original_image = None
        self.current_image = None
        self.cut_image = None
        self.current_grid_size = None
        self.color_mode = 0
        self.two_color_mode = False
        self.two_color_1 = None
        self.two_color_2 = None
        self.two_color_threshold = 0.5
        
        # 特大シート関連
        self.extra_large_parts = None
        self.extra_large_full = None
        self.current_extra_large_part_index = None
        self.extra_large_cells_w = None
        self.extra_large_cells_h = None
        
        # 編集関連
        self.edit_sheet_data = None
        self.edit_history = []
        self.selected_cells_for_edit = []
        self.edit_mode_active = False
        
        # ナビゲーション関連
        self.navigation_color_list = None
        self.navigation_current_index = None
        self.navigation_original_image = None
        
        # 色パレット定義
        self.color_palette = {
            'しろ': (230, 230, 230),
            'きいろ': (255, 255, 0),
            'あか': (255, 0, 0),
            'ピンク': (255, 192, 203),
            'あお': (0, 0, 255),
            'みずいろ': (135, 206, 235),
            'みどり': (0, 255, 0),
            'くろ': (10, 10, 10)
        }
        
        self.perler_basic_16 = {
            '5001_しろ': (255, 255, 255),
            '5003_きいろ': (255, 242, 0),
            '5005_あか': (221, 8, 8),
            '5006_ピンク': (255, 111, 152),
            '5008_あお': (43, 63, 135),
            '5009_みずいろ': (88, 171, 229),
            '5010_みどり': (53, 150, 63),
            '5018_くろ': (0, 0, 0),
            '5004_オレンジ': (255, 123, 0),
            '5007_むらさき': (112, 59, 155),
            '5017_はいいろ': (138, 141, 145),
            '5020_ちゃいろ': (113, 71, 42),
            '5033_ビーチ': (242, 193, 145),
            '5061_きみどり': (193, 228, 64),
            '5070_あおむらさき': (95, 82, 139),
            '5098_アプリコット': (253, 175, 130)
        }
        
        self.perler_extended_16 = {
            '5002_クリーム': (255, 243, 194),
            '5012_こげちゃいろ': (74, 46, 28),
            '5021_おうどいろ': (204, 187, 154),
            '5059_しゅいろ': (196, 30, 58),
            '5060_ぶどういろ': (134, 75, 122),
            '5091_あおみどり': (0, 131, 127),
            '5092_ダークグレイ': (77, 81, 86),
            '5097_マスカット': (168, 213, 155),
            '5011_うぐいすいろ': (108, 119, 64),
            '5019_とうめい': (230, 230, 230),
            '5035_こむぎいろ': (228, 172, 106),
            '5038_マゼンタ': (228, 0, 124),
            '5057_やまぶきいろ': (242, 186, 0),
            '5058_スカイブルー': (118, 200, 238),
            '5079_さくらいろ': (255, 205, 216),
            '5089_オーシャンブルー': (0, 102, 153)
        }
    
    def resize_to_fit(self, img_bgr, target_w, target_h):
        """画像をキャンバスサイズに合わせてリサイズ"""
        h, w = img_bgr.shape[:2]
        scale = min(target_w / w, target_h / h)
        new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
        resized = cv2.resize(img_bgr, (new_w, new_h))
        canvas = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        y0 = (target_h - new_h) // 2
        x0 = (target_w - new_w) // 2
        canvas[y0:y0+new_h, x0:x0+new_w] = resized
        return canvas
    
    def _edges(self, length, n):
        """均等に分割するためのエッジ座標を計算"""
        return [int(i * length / n) for i in range(n + 1)]
    
    def find_nearest_perler_color(self, bgr_color):
        """最も近いパーラービーズ色を見つける"""
        b, g, r = bgr_color
        
        if self.color_mode == 16:
            palette = self.perler_basic_16
        else:
            palette = {**self.perler_basic_16, **self.perler_extended_16}
        
        min_distance = float('inf')
        nearest_color = None
        
        for color_name, (pr, pg, pb) in palette.items():
            distance = ((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2) ** 0.5
            if distance < min_distance:
                min_distance = distance
                nearest_color = (pb, pg, pr)
        
        return nearest_color
    
    def find_nearest_two_color(self, bgr_color):
        """2色モード用の色判定"""
        b, g, r = bgr_color
        
        luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
        
        color1_rgb = self.color_palette[self.two_color_1]
        color2_rgb = self.color_palette[self.two_color_2]
        
        luminance1 = (0.299 * color1_rgb[0] + 0.587 * color1_rgb[1] + 0.114 * color1_rgb[2]) / 255.0
        luminance2 = (0.299 * color2_rgb[0] + 0.587 * color2_rgb[1] + 0.114 * color2_rgb[2]) / 255.0
        
        if luminance <= self.two_color_threshold:
            if luminance1 < luminance2:
                color_rgb = color1_rgb
            else:
                color_rgb = color2_rgb
        else:
            if luminance1 > luminance2:
                color_rgb = color1_rgb
            else:
                color_rgb = color2_rgb
        
        return (color_rgb[2], color_rgb[1], color_rgb[0])
    
    def _identify_color(self, r, g, b):
        """色を識別"""
        # 2色モード優先
        if self.two_color_mode and self.two_color_1 and self.two_color_2:
            color1_rgb = self.color_palette[self.two_color_1]
            color2_rgb = self.color_palette[self.two_color_2]
            
            distance1 = ((r - color1_rgb[0]) ** 2 + (g - color1_rgb[1]) ** 2 + (b - color1_rgb[2]) ** 2) ** 0.5
            distance2 = ((r - color2_rgb[0]) ** 2 + (g - color2_rgb[1]) ** 2 + (b - color2_rgb[2]) ** 2) ** 0.5
            
            if distance1 < distance2 and distance1 < 50:
                return self.two_color_1
            elif distance2 < 50:
                return self.two_color_2
        
        # 基本8色で完全一致または近似一致
        for color_name, rgb in self.color_palette.items():
            if r == rgb[0] and g == rgb[1] and b == rgb[2]:
                return color_name
            if abs(r - rgb[0]) <= 5 and abs(g - rgb[1]) <= 5 and abs(b - rgb[2]) <= 5:
                return color_name
        
        # 最も近い色を探す
        min_distance = float('inf')
        closest_color = "不明"
        
        if self.color_mode == 16:
            palette = {}
            for key, rgb in self.perler_basic_16.items():
                color_name = key.split('_')[1] if '_' in key else key
                palette[color_name] = rgb
        elif self.color_mode == 32:
            palette = {}
            for key, rgb in {**self.perler_basic_16, **self.perler_extended_16}.items():
                color_name = key.split('_')[1] if '_' in key else key
                palette[color_name] = rgb
        else:
            palette = self.color_palette
        
        for color_name, rgb in palette.items():
            distance = ((r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2) ** 0.5
            if distance < min_distance:
                min_distance = distance
                closest_color = color_name
        
        return closest_color
    
    def generate_text_image(self, text, text_color, bg_color):
        """文字から画像を生成 - 位置調整版"""
        cell_size = 30
        
        chars_info = []
        total_width_cells = 0
        
        for char in text:
            code = ord(char)
            if 0x20 <= code <= 0x7E or 0xFF61 <= code <= 0xFF9F:
                is_full = False
                width_cells = 7
            else:
                is_full = True
                width_cells = 14
            
            chars_info.append({
                'char': char,
                'is_full_width': is_full,
                'width_cells': width_cells,
                'width_pixels': width_cells * cell_size
            })
            
            total_width_cells += width_cells
        
        image_width = total_width_cells * cell_size
        image_height = 14 * cell_size
        
        bg_rgb = self.color_palette[bg_color]
        img = Image.new('RGB', (image_width, image_height), bg_rgb)
        draw = ImageDraw.Draw(img)
        
        try:
            base_font_size = int(image_height * 0.85)
            
            font_paths = [
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
                "/usr/share/fonts/truetype/noto-cjk/NotoSansCJK-Regular.ttc", 
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
            ]
            
            font = None
            for font_path in font_paths:
                if os.path.exists(font_path):
                    try:
                        font = ImageFont.truetype(font_path, base_font_size)
                        print(f"✅ フォント読み込み成功: {font_path}")
                        break
                    except:
                        continue
            
            if font is None:
                print("⚠️ TTFフォントが見つかりません。デフォルトフォントを使用します")
                img_array = np.array(img)
                img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                text_rgb = self.color_palette[text_color]
                text_bgr = (text_rgb[2], text_rgb[1], text_rgb[0])
                
                font_scale = image_height / 50
                thickness = max(2, int(font_scale * 2))
                
                (text_width, text_height), baseline = cv2.getTextSize(
                    text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness
                )
                
                x = (image_width - text_width) // 2
                y = (image_height + text_height) // 2
                
                cv2.putText(img_bgr, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX,
                           font_scale, text_bgr, thickness, cv2.LINE_AA)
                
                return img_bgr
            
            bbox_test = draw.textbbox((0, 0), "Hgjpqy", font=font)
            total_height = bbox_test[3] - bbox_test[1]
            
            if total_height > image_height * 0.95:
                scale = (image_height * 0.95) / total_height
                base_font_size = int(base_font_size * scale)
                font = ImageFont.truetype(font_paths[0], base_font_size)
                bbox_test = draw.textbbox((0, 0), "Hgjpqy", font=font)
                total_height = bbox_test[3] - bbox_test[1]
            
            # 修正(2): y座標30%上はそのまま
            full_bbox = draw.textbbox((0, 0), text, font=font)
            full_text_height = full_bbox[3] - full_bbox[1]
            
            y_position = (image_height - full_text_height) // 2 - int(full_text_height * 0.3)
            
            text_rgb = self.color_palette[text_color]
            current_x = 0
            
            for char_info in chars_info:
                char = char_info['char']
                char_width = char_info['width_pixels']
                
                bbox_char = draw.textbbox((0, 0), char, font=font)
                text_width = bbox_char[2] - bbox_char[0]
                
                # 修正(2): 横方向を0.95倍に変更
                actual_char_width = int(char_width * 0.95)
                
                x = current_x + (actual_char_width - text_width) // 2
                y = y_position
                
                draw.text((x, y), char, font=font, fill=text_rgb)
                current_x += actual_char_width
            
            img_array = np.array(img)
            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            return img_bgr
            
        except Exception as e:
            print(f"⚠ エラー: {e}")
            return None

#Part2
    def create_bead_sheet(self, img, grid_size, use_perler_colors=False):
        """ビーズシートを作成"""
        if img is None:
            return None
        
        h, w = img.shape[:2]
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
        
        coords = cv2.findNonZero(binary)
        if coords is not None:
            x, y, region_w, region_h = cv2.boundingRect(coords)
            image_region = img[y:y+region_h, x:x+region_w]
        else:
            image_region = img
            region_h, region_w = img.shape[:2]
        
        scale = grid_size / 29.0
        scaled_w = int(region_w * scale)
        scaled_h = int(region_h * scale)
        
        if scale < 1.0:
            image_region = cv2.resize(image_region, (scaled_w, scaled_h), interpolation=cv2.INTER_AREA)
        
        cell_size = 30
        cells_w = scaled_w // cell_size
        cells_h = scaled_h // cell_size
        
        adjusted_w = cells_w * cell_size
        adjusted_h = cells_h * cell_size
        
        image_region = image_region[0:adjusted_h, 0:adjusted_w]
        
        max_cells = 29
        canvas_size = max_cells * cell_size
        sheet = np.ones((canvas_size, canvas_size, 3), dtype=np.uint8) * 255
        
        for cy in range(max_cells):
            for cx in range(max_cells):
                x0 = cx * cell_size
                y0 = cy * cell_size
                x1 = x0 + cell_size
                y1 = y0 + cell_size
                
                avg_color = (255, 255, 255)
                is_in_image_range = False
                
                if cy < cells_h and cx < cells_w:
                    is_in_image_range = True
                    cell = image_region[y0:y1, x0:x1]
                    if cell.size > 0:
                        b, g, rch = np.mean(cell.reshape(-1, 3), axis=0)
                        avg_color = (int(b), int(g), int(rch))
                
                if is_in_image_range and use_perler_colors:
                    if self.two_color_mode:
                        color = self.find_nearest_two_color(avg_color)
                    else:
                        color = self.find_nearest_perler_color(avg_color)
                else:
                    color = avg_color
                
                r = max(1, int(cell_size * 0.49))
                cx_center = (x0 + x1) // 2
                cy_center = (y0 + y1) // 2
                cv2.circle(sheet, (cx_center, cy_center), r, color, -1, lineType=cv2.LINE_AA)
        
        if canvas_size != self.disp_w:
            sheet_resized = cv2.resize(sheet, (self.disp_w, self.disp_h), interpolation=cv2.INTER_NEAREST)
        else:
            sheet_resized = sheet.copy()
        
        scale_val = self.disp_w / canvas_size
        
        for i in range(max_cells + 1):
            x = int(i * cell_size * scale_val)
            if x >= self.disp_w:
                x = self.disp_w - 1
            cv2.line(sheet_resized, (x, 0), (x, self.disp_h - 1), (0, 0, 0), 1)
        
        for i in range(max_cells + 1):
            y = int(i * cell_size * scale_val)
            if y >= self.disp_h:
                y = self.disp_h - 1
            cv2.line(sheet_resized, (0, y), (self.disp_w - 1, y), (0, 0, 0), 1)
        
        border_right = int((cells_w * cell_size) * scale_val)
        border_bottom = int((cells_h * cell_size) * scale_val)
        
        if border_right >= self.disp_w:
            border_right = self.disp_w - 1
        if border_bottom >= self.disp_h:
            border_bottom = self.disp_h - 1
        
        cv2.line(sheet_resized, (0, 0), (border_right, 0), (0, 0, 255), 2)
        cv2.line(sheet_resized, (border_right, 0), (border_right, border_bottom), (0, 0, 255), 2)
        cv2.line(sheet_resized, (0, border_bottom), (border_right, border_bottom), (0, 0, 255), 2)
        cv2.line(sheet_resized, (0, 0), (0, border_bottom), (0, 0, 255), 2)
        
        return sheet_resized
    
    def get_cell_from_coordinates(self, x, y, grid_size=29):
        """クリック座標からセル番号を取得"""
        cell_size = self.disp_w / grid_size
        cell_x = int(x / cell_size)
        cell_y = int(y / cell_size)
        
        if 0 <= cell_x < grid_size and 0 <= cell_y < grid_size:
            return (cell_x, cell_y)
        return None
    
    def toggle_cell_selection(self, cell):
        """セルの選択/選択解除を切り替え"""
        if cell in self.selected_cells_for_edit:
            self.selected_cells_for_edit.remove(cell)
        else:
            self.selected_cells_for_edit.append(cell)
    
    def draw_cell_highlight(self, image, cells, grid_size=29):
        """選択されたセルをハイライト表示"""
        img = image.copy()
        cell_size = self.disp_w / grid_size
        
        for cell_x, cell_y in cells:
            x0 = int(cell_x * cell_size)
            y0 = int(cell_y * cell_size)
            x1 = int((cell_x + 1) * cell_size)
            y1 = int((cell_y + 1) * cell_size)
            
            cv2.rectangle(img, (x0, y0), (x1, y1), (0, 255, 255), 3)
        
        return img
    
    def change_selected_cells_color(self, image, cells, color_name, grid_size=29):
        """選択されたセルの色を変更 - 修正版(1)"""
        img = image.copy()
        cell_size = self.disp_w / grid_size
        
        rgb = self.color_palette[color_name]
        bgr = (rgb[2], rgb[1], rgb[0])
        
        for cell_x, cell_y in cells:
            x0 = int(cell_x * cell_size)
            y0 = int(cell_y * cell_size)
            x1 = int((cell_x + 1) * cell_size)
            y1 = int((cell_y + 1) * cell_size)
            
            # セル全体を白で塗りつぶし
            cv2.rectangle(img, (x0, y0), (x1, y1), (255, 255, 255), -1)
            
            # 円を描画
            r = int(cell_size * 0.49)
            cx_center = (x0 + x1) // 2
            cy_center = (y0 + y1) // 2
            cv2.circle(img, (cx_center, cy_center), r, bgr, -1, lineType=cv2.LINE_AA)
        
        # 修正(1): グリッド線を正しく再描画
        for i in range(grid_size + 1):
            x = int(i * cell_size)
            if x >= self.disp_w:
                x = self.disp_w - 1
            cv2.line(img, (x, 0), (x, self.disp_h - 1), (0, 0, 0), 1)
        
        for i in range(grid_size + 1):
            y = int(i * cell_size)
            if y >= self.disp_h:
                y = self.disp_h - 1
            cv2.line(img, (0, y), (self.disp_w - 1, y), (0, 0, 0), 1)
        
        return img
    
    def delete_selected_cells(self, image, cells, grid_size=29):
        """選択されたセルを削除(背景色に) - 修正版(1)"""
        img = image.copy()
        cell_size = self.disp_w / grid_size
        
        for cell_x, cell_y in cells:
            x0 = int(cell_x * cell_size)
            y0 = int(cell_y * cell_size)
            x1 = int((cell_x + 1) * cell_size)
            y1 = int((cell_y + 1) * cell_size)
            
            cv2.rectangle(img, (x0, y0), (x1, y1), (254, 254, 254), -1)
        
        # 修正(1): グリッド線を正しく再描画
        for i in range(grid_size + 1):
            x = int(i * cell_size)
            if x >= self.disp_w:
                x = self.disp_w - 1
            cv2.line(img, (x, 0), (x, self.disp_h - 1), (0, 0, 0), 1)
        
        for i in range(grid_size + 1):
            y = int(i * cell_size)
            if y >= self.disp_h:
                y = self.disp_h - 1
            cv2.line(img, (0, y), (self.disp_w - 1, y), (0, 0, 0), 1)
        
        return img
    
    def create_extra_large_bead_sheet(self, img, use_perler_colors=False):
        """特大ビーズシート(58×58セル)を作成"""
        if img is None:
            return None, None, None
        
        h, w = img.shape[:2]
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
        
        coords = cv2.findNonZero(binary)
        if coords is not None:
            x, y, region_w, region_h = cv2.boundingRect(coords)
            image_region = img[y:y+region_h, x:x+region_w]
        else:
            image_region = img
            region_h, region_w = img.shape[:2]
        
        cell_size = 15
        cells_w = region_w // cell_size
        cells_h = region_h // cell_size
        
        adjusted_w = cells_w * cell_size
        adjusted_h = cells_h * cell_size
        
        image_region = image_region[0:adjusted_h, 0:adjusted_w]
        
        max_cells = 58
        canvas_size = max_cells * cell_size
        sheet = np.ones((canvas_size, canvas_size, 3), dtype=np.uint8) * 255
        
        for cy in range(max_cells):
            for cx in range(max_cells):
                x0 = cx * cell_size
                y0 = cy * cell_size
                x1 = x0 + cell_size
                y1 = y0 + cell_size
                
                avg_color = (255, 255, 255)
                is_in_image_range = False
                
                if cy < cells_h and cx < cells_w:
                    is_in_image_range = True
                    cell = image_region[y0:y1, x0:x1]
                    if cell.size > 0:
                        b, g, rch = np.mean(cell.reshape(-1, 3), axis=0)
                        avg_color = (int(b), int(g), int(rch))
                
                if is_in_image_range and use_perler_colors:
                    if self.two_color_mode:
                        color = self.find_nearest_two_color(avg_color)
                    else:
                        color = self.find_nearest_perler_color(avg_color)
                else:
                    color = avg_color
                
                r = max(1, int(cell_size * 0.49))
                cx_center = (x0 + x1) // 2
                cy_center = (y0 + y1) // 2
                cv2.circle(sheet, (cx_center, cy_center), r, color, -1, lineType=cv2.LINE_AA)
        
        sheet_resized = cv2.resize(sheet, (self.disp_w, self.disp_h), interpolation=cv2.INTER_NEAREST)
        
        scale = self.disp_w / canvas_size
        
        for i in range(max_cells + 1):
            x = int(i * cell_size * scale)
            if x >= self.disp_w:
                x = self.disp_w - 1
            cv2.line(sheet_resized, (x, 0), (x, self.disp_h - 1), (0, 0, 0), 1)
        
        for i in range(max_cells + 1):
            y = int(i * cell_size * scale)
            if y >= self.disp_h:
                y = self.disp_h - 1
            cv2.line(sheet_resized, (0, y), (self.disp_w - 1, y), (0, 0, 0), 1)
        
        border_right = int((cells_w * cell_size) * scale)
        border_bottom = int((cells_h * cell_size) * scale)
        
        if border_right >= self.disp_w:
            border_right = self.disp_w - 1
        if border_bottom >= self.disp_h:
            border_bottom = self.disp_h - 1
        
        cv2.line(sheet_resized, (0, 0), (border_right, 0), (0, 0, 255), 2)
        cv2.line(sheet_resized, (border_right, 0), (border_right, border_bottom), (0, 0, 255), 2)
        cv2.line(sheet_resized, (0, border_bottom), (border_right, border_bottom), (0, 0, 255), 2)
        cv2.line(sheet_resized, (0, 0), (0, border_bottom), (0, 0, 255), 2)
        
        parts = []
        cell_size_display = self.disp_w / 58
        
        for part_idx in range(4):
            row = part_idx // 2
            col = part_idx % 2
            
            start_cell_x = col * 29
            start_cell_y = row * 29
            
            start_x = int(start_cell_x * cell_size_display)
            start_y = int(start_cell_y * cell_size_display)
            end_x = int((start_cell_x + 29) * cell_size_display)
            end_y = int((start_cell_y + 29) * cell_size_display)
            
            if end_x > self.disp_w:
                end_x = self.disp_w
            if end_y > self.disp_h:
                end_y = self.disp_h
            
            part_image = sheet_resized[start_y:end_y, start_x:end_x].copy()
            
            part_resized = cv2.resize(part_image, (self.disp_w, self.disp_h), interpolation=cv2.INTER_NEAREST)
            
            parts.append(part_resized)
        
        self.extra_large_cells_w = cells_w
        self.extra_large_cells_h = cells_h
        
        return sheet_resized, parts, {"cells_w": cells_w, "cells_h": cells_h}
    
    def _count_bead_colors(self, image):
        """ビーズの色をカウント"""
        color_counts = {}
        cell_size = self.disp_w / 29
        
        for cy in range(29):
            for cx in range(29):
                x0 = int(cx * cell_size)
                y0 = int(cy * cell_size)
                x1 = int((cx + 1) * cell_size)
                y1 = int((cy + 1) * cell_size)
                
                center_x = (x0 + x1) // 2
                center_y = (y0 + y1) // 2
                
                if center_y < image.shape[0] and center_x < image.shape[1]:
                    pixel = image[center_y, center_x]
                    b, g, r = int(pixel[0]), int(pixel[1]), int(pixel[2])
                    
                    # 白色のみスキップ
                    if r >= 252 and g >= 252 and b >= 252:
                        continue
                    
                    color_name = self._identify_color(r, g, b)
                    
                    if color_name in color_counts:
                        color_counts[color_name] += 1
                    else:
                        color_counts[color_name] = 1
        
        return color_counts
    
    def count_bead_colors_extra_large(self, image, part_index=None):
        """特大シートのビーズ色をカウント"""
        color_counts = {}
        
        if part_index is not None:
            grid_size = 29
        else:
            grid_size = 58
        
        cell_size = self.disp_w / grid_size
        
        for cy in range(grid_size):
            for cx in range(grid_size):
                x0 = int(cx * cell_size)
                y0 = int(cy * cell_size)
                x1 = int((cx + 1) * cell_size)
                y1 = int((cy + 1) * cell_size)
                
                center_x = (x0 + x1) // 2
                center_y = (y0 + y1) // 2
                
                if center_y < image.shape[0] and center_x < image.shape[1]:
                    pixel = image[center_y, center_x]
                    b, g, r = int(pixel[0]), int(pixel[1]), int(pixel[2])
                    
                    # 白色のみスキップ
                    if r >= 252 and g >= 252 and b >= 252:
                        continue
                    
                    color_name = self._identify_color(r, g, b)
                    
                    if color_name in color_counts:
                        color_counts[color_name] += 1
                    else:
                        color_counts[color_name] = 1
        
        return color_counts
    
    def create_navigation_image(self, image, color_name):
        """ナビゲーション用に特定色のみ表示"""
        display_img = image.copy()
        cell_size = self.disp_w / 29
        
        for cy in range(29):
            for cx in range(29):
                x0 = int(cx * cell_size)
                y0 = int(cy * cell_size)
                x1 = int((cx + 1) * cell_size)
                y1 = int((cy + 1) * cell_size)
                
                center_x = (x0 + x1) // 2
                center_y = (y0 + y1) // 2
                
                if center_y < display_img.shape[0] and center_x < display_img.shape[1]:
                    pixel = display_img[center_y, center_x]
                    b, g, r = int(pixel[0]), int(pixel[1]), int(pixel[2])
                    
                    # 白色のみスキップ
                    if r >= 252 and g >= 252 and b >= 252:
                        continue
                    
                    cell_color_name = self._identify_color(r, g, b)
                    
                    if cell_color_name != color_name:
                        cv2.rectangle(display_img, (x0, y0), (x1, y1), (255, 255, 255), -1)
        
        for i in range(30):
            x = int(i * cell_size)
            if x >= self.disp_w:
                x = self.disp_w - 1
            cv2.line(display_img, (x, 0), (x, self.disp_h - 1), (0, 0, 0), 1)
        
        for i in range(30):
            y = int(i * cell_size)
            if y >= self.disp_h:
                y = self.disp_h - 1
            cv2.line(display_img, (0, y), (self.disp_w - 1, y), (0, 0, 0), 1)
        
        return display_img
    
    def create_navigation_image_extra_large(self, image, color_name, grid_size=29):
        """特大シート用ナビゲーション画像"""
        display_img = image.copy()
        cell_size = self.disp_w / grid_size
        
        for cy in range(grid_size):
            for cx in range(grid_size):
                x0 = int(cx * cell_size)
                y0 = int(cy * cell_size)
                x1 = int((cx + 1) * cell_size)
                y1 = int((cy + 1) * cell_size)
                
                center_x = (x0 + x1) // 2
                center_y = (y0 + y1) // 2
                
                if center_y < display_img.shape[0] and center_x < display_img.shape[1]:
                    pixel = display_img[center_y, center_x]
                    b, g, r = int(pixel[0]), int(pixel[1]), int(pixel[2])
                    
                    # 白色のみスキップ
                    if r >= 252 and g >= 252 and b >= 252:
                        continue
                    
                    cell_color_name = self._identify_color(r, g, b)
                    
                    if cell_color_name != color_name:
                        cv2.rectangle(display_img, (x0, y0), (x1, y1), (255, 255, 255), -1)
        
        for i in range(grid_size + 1):
            x = int(i * cell_size)
            if x >= self.disp_w:
                x = self.disp_w - 1
            cv2.line(display_img, (x, 0), (x, self.disp_h - 1), (0, 0, 0), 1)
        
        for i in range(grid_size + 1):
            y = int(i * cell_size)
            if y >= self.disp_h:
                y = self.disp_h - 1
            cv2.line(display_img, (0, y), (self.disp_w - 1, y), (0, 0, 0), 1)
        
        return display_img

# クラス定義終了

# appインスタンスを作成
app = IronBeadsApp()

#Part3
# ============================================
# グローバル状態管理
# ============================================

current_state = {
    'processed_image': None,
    'bead_sheet': None,
    'navigation_list': None,
    'navigation_index': 0,
    'crop_points': [],
}

edit_state = {
    'current_sheet': None,
    'selected_cells': [],
    'grid_size': 29,
    'history': [],
    'range_select_mode': False,
    'range_points': []
}

extra_large_state = {
    'full_sheet': None,
    'parts': [],
    'current_part_index': 0,
    'info': None
}

# ============================================
# UI関数定義
# ============================================

def process_uploaded_image(image):
    """アップロードされた画像を処理"""
    if image is None:
        return None, "画像をアップロードしてください"
    
    img_array = np.array(image)
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    h, w = img_bgr.shape[:2]
    if w >= h:
        new_w = 930
        new_h = int(h * (930 / w))
    else:
        new_h = 930
        new_w = int(w * (930 / h))
    
    resized = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    
    canvas = np.zeros((930, 930, 3), dtype=np.uint8)
    canvas[0:new_h, 0:new_w] = resized
    
    app.original_image = canvas.copy()
    app.cut_image = canvas.copy()
    current_state['processed_image'] = canvas.copy()
    current_state['crop_points'] = []
    
    display_img = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
    
    return display_img, "✅ 画像を処理しました\n💡 範囲を切り出す場合は、画像の左上と右下を2回クリックしてください"

def handle_crop_click(evt: gr.SelectData):
    """画像切り出し用のクリックハンドラ"""
    if app.original_image is None:
        return None, "先に画像をアップロードしてください"
    
    x, y = evt.index
    current_state['crop_points'].append((x, y))
    
    if len(current_state['crop_points']) == 1:
        img = app.original_image.copy()
        cv2.circle(img, (x, y), 10, (0, 255, 0), -1)
        cv2.putText(img, "START", (x+15, y), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        display_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return display_img, f"✅ 1点目: ({x}, {y})\n💡 右下をクリックしてください"
    
    elif len(current_state['crop_points']) == 2:
        x1, y1 = current_state['crop_points'][0]
        x2, y2 = current_state['crop_points'][1]
        
        x_min = min(x1, x2)
        x_max = max(x1, x2)
        y_min = min(y1, y2)
        y_max = max(y1, y2)
        
        if x_min >= x_max or y_min >= y_max:
            current_state['crop_points'] = []
            return None, "⚠ 無効な範囲です。もう一度選択してください"
        
        cropped = app.original_image[y_min:y_max, x_min:x_max].copy()
        
        h_crop, w_crop = cropped.shape[:2]
        if w_crop >= h_crop:
            new_w = 930
            new_h = int(h_crop * (930 / w_crop))
        else:
            new_h = 930
            new_w = int(w_crop * (930 / h_crop))
        
        resized = cv2.resize(cropped, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        
        canvas = np.zeros((930, 930, 3), dtype=np.uint8)
        canvas[0:new_h, 0:new_w] = resized
        
        app.cut_image = canvas.copy()
        current_state['processed_image'] = canvas.copy()
        current_state['crop_points'] = []
        
        display_img = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        
        return display_img, f"✅ 範囲({x_min},{y_min})〜({x_max},{y_max})を切り出しました"
    
    return None, "エラーが発生しました"

def create_text_image(text, text_color, bg_color):
    """文字から画像を生成"""
    if not text:
        return None, "文字を入力してください"
    
    img_bgr = app.generate_text_image(text, text_color, bg_color)
    
    if img_bgr is None:
        return None, "⚠ 画像生成に失敗しました"
    
    h, w = img_bgr.shape[:2]
    if w >= h:
        new_w = 930
        new_h = int(h * (930 / w))
    else:
        new_h = 930
        new_w = int(w * (930 / h))
    
    resized = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    
    canvas = np.zeros((930, 930, 3), dtype=np.uint8)
    canvas[0:new_h, 0:new_w] = resized
    
    app.original_image = canvas.copy()
    app.cut_image = canvas.copy()
    current_state['processed_image'] = canvas.copy()
    current_state['crop_points'] = []
    
    display_img = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
    
    return display_img, f"✅ 文字「{text}」から画像を作成しました\n💡 範囲を切り出す場合は、画像の左上と右下を2回クリックしてください"

def create_bead_sheet_ui(sheet_size, color_mode, color1, color2, threshold):
    """ビーズシートを作成"""
    if current_state['processed_image'] is None:
        return None, "先に画像を処理してください"
    
    size_map = {"大 (29セル)": 29, "中 (21セル)": 21, "小 (13セル)": 13}
    grid_size = size_map.get(sheet_size, 29)
    
    app.current_grid_size = grid_size
    
    if color_mode == "元の色":
        app.color_mode = 0
        app.two_color_mode = False
        use_perler = False
    elif color_mode == "2色":
        if not color1 or not color2:
            return None, "⚠ 2色を選択してください"
        app.color_mode = 2
        app.two_color_mode = True
        app.two_color_1 = color1
        app.two_color_2 = color2
        app.two_color_threshold = threshold / 100.0
        use_perler = True
    elif color_mode == "16色(基本)":
        app.color_mode = 16
        app.two_color_mode = False
        use_perler = True
    elif color_mode == "32色(基本+拡張)":
        app.color_mode = 32
        app.two_color_mode = False
        use_perler = True
    else:
        use_perler = False
    
    sheet = app.create_bead_sheet(current_state['processed_image'], grid_size, use_perler)
    
    if sheet is None:
        return None, "⚠ シート作成に失敗しました"
    
    current_state['bead_sheet'] = sheet.copy()
    
    display_img = cv2.cvtColor(sheet, cv2.COLOR_BGR2RGB)
    
    mode_text = color_mode
    if color_mode == "2色":
        mode_text = f"2色({color1}/{color2})"
    
    return display_img, f"✅ {sheet_size}のビーズシートを作成しました({mode_text})"

def start_edit_mode():
    """編集モードを開始"""
    if current_state['bead_sheet'] is None:
        return None, "先にビーズシートを作成してください", ""
    
    edit_state['current_sheet'] = current_state['bead_sheet'].copy()
    edit_state['selected_cells'] = []
    edit_state['history'] = [current_state['bead_sheet'].copy()]
#    edit_state['grid_size'] = app.current_grid_size if app.current_grid_size else 29
    edit_state['grid_size'] = 29 #追加20251020 16:50
    edit_state['range_select_mode'] = False
    edit_state['range_points'] = []
    
    display_img = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
    
    return display_img, "✅ 編集モード開始\n💡 画像をクリックしてセルを選択できます", "選択中: 0個のセル"

def start_range_select_mode():
    """範囲選択モードを開始"""
    if edit_state['current_sheet'] is None:
        return None, "先に編集モードを開始してください", ""
    
    edit_state['range_select_mode'] = True
    edit_state['range_points'] = []
    
    display_img = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
    
    return display_img, "✅ 範囲選択モード開始\n💡 左上のセルをクリックしてください", f"選択中: {len(edit_state['selected_cells'])}個のセル"

def handle_canvas_click(evt: gr.SelectData):
    """キャンバスクリックイベント処理"""
    if edit_state['current_sheet'] is None:
        return None, "先に編集モードを開始してください", ""
    
    x, y = evt.index
    grid_size = edit_state['grid_size']
    cell = app.get_cell_from_coordinates(x, y, grid_size)
    
    if cell is None:
        return None, "⚠ 範囲外をクリックしました", f"選択中: {len(edit_state['selected_cells'])}個のセル"
    
    if edit_state['range_select_mode']:
        edit_state['range_points'].append(cell)
        
        if len(edit_state['range_points']) == 1:
            img = edit_state['current_sheet'].copy()
            highlighted = app.draw_cell_highlight(img, [cell], grid_size)
            display_img = cv2.cvtColor(highlighted, cv2.COLOR_BGR2RGB)
            return display_img, f"✅ 範囲の左上: ({cell[0]}, {cell[1]})\n💡 右下のセルをクリックしてください", f"選択中: {len(edit_state['selected_cells'])}個のセル"
        
        elif len(edit_state['range_points']) == 2:
            cell1 = edit_state['range_points'][0]
            cell2 = edit_state['range_points'][1]
            
            x_min = min(cell1[0], cell2[0])
            x_max = max(cell1[0], cell2[0])
            y_min = min(cell1[1], cell2[1])
            y_max = max(cell1[1], cell2[1])
            
            edit_state['selected_cells'] = []
            for cy in range(y_min, y_max + 1):
                for cx in range(x_min, x_max + 1):
                    edit_state['selected_cells'].append((cx, cy))
            
            edit_state['range_select_mode'] = False
            edit_state['range_points'] = []
            
            highlighted = app.draw_cell_highlight(
                edit_state['current_sheet'], 
                edit_state['selected_cells'],
                grid_size
            )
            
            display_img = cv2.cvtColor(highlighted, cv2.COLOR_BGR2RGB)
            
            return display_img, f"✅ 範囲({x_min},{y_min})〜({x_max},{y_max})を選択しました", f"選択中: {len(edit_state['selected_cells'])}個のセル"
    
    if cell in edit_state['selected_cells']:
        edit_state['selected_cells'].remove(cell)
    else:
        edit_state['selected_cells'].append(cell)
    
    highlighted = app.draw_cell_highlight(
        edit_state['current_sheet'], 
        edit_state['selected_cells'],
        grid_size
    )
    
    display_img = cv2.cvtColor(highlighted, cv2.COLOR_BGR2RGB)
    
    return display_img, f"✅ セル({cell[0]}, {cell[1]})を選択切替", f"選択中: {len(edit_state['selected_cells'])}個のセル"

def clear_selection():
    """選択をクリア"""
    if edit_state['current_sheet'] is None:
        return None, "先に編集モードを開始してください", ""
    
    edit_state['selected_cells'] = []
    edit_state['range_select_mode'] = False
    edit_state['range_points'] = []
    
    display_img = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
    
    return display_img, "✅ 選択をクリアしました", "選択中: 0個のセル"

def change_cells_color(color_name):
    """選択されたセルの色を変更"""
    if edit_state['current_sheet'] is None:
        return None, "先に編集モードを開始してください", ""
    
    if not edit_state['selected_cells']:
        return None, "⚠ セルを選択してください", "選択中: 0個のセル"
    
    edit_state['history'].append(edit_state['current_sheet'].copy())
    
    edit_state['current_sheet'] = app.change_selected_cells_color(
        edit_state['current_sheet'],
        edit_state['selected_cells'],
        color_name,
        edit_state['grid_size']
    )
    
    edit_state['selected_cells'] = []
    
    display_img = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
    
    return display_img, f"✅ {color_name}に変更しました", "選択中: 0個のセル"

def delete_cells():
    """選択されたセルを削除"""
    if edit_state['current_sheet'] is None:
        return None, "先に編集モードを開始してください", ""
    
    if not edit_state['selected_cells']:
        return None, "⚠ セルを選択してください", "選択中: 0個のセル"
    
    edit_state['history'].append(edit_state['current_sheet'].copy())
    
    edit_state['current_sheet'] = app.delete_selected_cells(
        edit_state['current_sheet'],
        edit_state['selected_cells'],
        edit_state['grid_size']
    )
    
    edit_state['selected_cells'] = []
    
    display_img = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
    
    return display_img, "✅ セルを削除しました", "選択中: 0個のセル"

def undo_edit():
    """1つ戻る"""
    if edit_state['current_sheet'] is None:
        return None, "先に編集モードを開始してください", ""
    
    if edit_state['selected_cells']:
        edit_state['selected_cells'] = []
        display_img = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
        return display_img, "✅ 選択を解除しました", "選択中: 0個のセル"
    
    if len(edit_state['history']) > 1:
        edit_state['history'].pop()
        edit_state['current_sheet'] = edit_state['history'][-1].copy()
        
        display_img = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
        return display_img, "✅ 1つ戻りました", "選択中: 0個のセル"
    
    return None, "⚠ これ以上戻れません", f"選択中: {len(edit_state['selected_cells'])}個のセル"

def confirm_edit():
    """編集を確定"""
    if edit_state['current_sheet'] is None:
        return None, "先に編集モードを開始してください"
    
    current_state['bead_sheet'] = edit_state['current_sheet'].copy()
    
    display_img = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
    
    return display_img, "✅ 編集を確定しました"

def cancel_edit():
    """編集をキャンセル"""
    edit_state['current_sheet'] = None
    edit_state['selected_cells'] = []
    edit_state['history'] = []
    edit_state['range_select_mode'] = False
    edit_state['range_points'] = []
    
    if current_state['bead_sheet'] is not None:
        display_img = cv2.cvtColor(current_state['bead_sheet'], cv2.COLOR_BGR2RGB)
        return display_img, "✅ 編集をキャンセルしました"
    
    return None, "編集をキャンセルしました"

def reset_all():
    """すべてをリセット"""
    current_state['processed_image'] = None
    current_state['bead_sheet'] = None
    current_state['navigation_list'] = None
    current_state['navigation_index'] = 0
    current_state['crop_points'] = []
    edit_state['range_select_mode'] = False
    edit_state['range_points'] = []
    app.cut_image = None
    app.original_image = None
    return None, None, "リセットしました"

# 保存関数
def save_processed_image():
    """処理済み画像を保存"""
    if current_state['processed_image'] is None:
        return None, "⚠ 保存する画像がありません"
    
    img_rgb = cv2.cvtColor(current_state['processed_image'], cv2.COLOR_BGR2RGB)
    img_pil = Image.fromarray(img_rgb)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"processed_{timestamp}.png"
    
    temp_path = os.path.join(tempfile.gettempdir(), filename)
    img_pil.save(temp_path)
    
    return temp_path, f"✅ 画像を保存しました（{filename}）"

def save_bead_sheet():
    """ビーズシートを保存"""
    if current_state['bead_sheet'] is None:
        return None, "⚠ 保存するビーズシートがありません"
    
    img_rgb = cv2.cvtColor(current_state['bead_sheet'], cv2.COLOR_BGR2RGB)
    img_pil = Image.fromarray(img_rgb)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"bead_sheet_{timestamp}.png"
    
    temp_path = os.path.join(tempfile.gettempdir(), filename)
    img_pil.save(temp_path)
    
    return temp_path, f"✅ ビーズシートを保存しました（{filename}）"

def save_edited_sheet():
    """編集中のシートを保存"""
    if edit_state['current_sheet'] is None:
        return None, "⚠ 保存する編集シートがありません"
    
    img_rgb = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
    img_pil = Image.fromarray(img_rgb)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"edited_sheet_{timestamp}.png"
    
    temp_path = os.path.join(tempfile.gettempdir(), filename)
    img_pil.save(temp_path)
    
    return temp_path, f"✅ 編集シートを保存しました（{filename}）"

# 特大シートUI関数（省略 - 前回と同じ）
def create_extra_large_sheet_ui(color_mode, color1, color2, threshold):
    if current_state['processed_image'] is None:
        return None, None, "先に画像を処理してください"
    
    if color_mode == "元の色":
        app.color_mode = 0
        app.two_color_mode = False
        use_perler = False
    elif color_mode == "2色":
        if not color1 or not color2:
            return None, None, "⚠ 2色を選択してください"
        app.color_mode = 2
        app.two_color_mode = True
        app.two_color_1 = color1
        app.two_color_2 = color2
        app.two_color_threshold = threshold / 100.0
        use_perler = True
    elif color_mode == "16色(基本)":
        app.color_mode = 16
        app.two_color_mode = False
        use_perler = True
    elif color_mode == "32色(基本+拡張)":
        app.color_mode = 32
        app.two_color_mode = False
        use_perler = True
    else:
        use_perler = False
    
    full_sheet, parts, info = app.create_extra_large_bead_sheet(
        current_state['processed_image'], 
        use_perler
    )
    
    if full_sheet is None:
        return None, None, "⚠ シート作成に失敗しました"
    
    extra_large_state['full_sheet'] = full_sheet.copy()
    extra_large_state['parts'] = parts
    extra_large_state['current_part_index'] = 0
    extra_large_state['info'] = info
    current_state['bead_sheet'] = full_sheet.copy()
    
    display_full = cv2.cvtColor(full_sheet, cv2.COLOR_BGR2RGB)
    display_part = cv2.cvtColor(parts[0], cv2.COLOR_BGR2RGB)
    
    mode_text = color_mode
    if color_mode == "2色":
        mode_text = f"2色({color1}/{color2})"
    
    status = f"✅ 特大(58×58セル)のビーズシートを作成しました({mode_text})\n実際の範囲: {info['cells_w']}×{info['cells_h']}セル"
    
    return display_full, display_part, status

def switch_extra_large_part(part_number):
    if not extra_large_state['parts']:
        return None, "先に特大シートを作成してください"
    
    part_index = part_number - 1
    
    if 0 <= part_index < len(extra_large_state['parts']):
        extra_large_state['current_part_index'] = part_index
        
        part_image = extra_large_state['parts'][part_index]
        display_img = cv2.cvtColor(part_image, cv2.COLOR_BGR2RGB)
        
        return display_img, f"✅ {part_number}/4 パーツを表示中"
    
    return None, "⚠ パーツ番号が無効です"

def start_edit_extra_large_part(part_number):
    if not extra_large_state['parts']:
        return None, "先に特大シートを作成してください", ""
    
    part_index = part_number - 1
    
    if not (0 <= part_index < len(extra_large_state['parts'])):
        return None, "⚠ パーツ番号が無効です", ""
    
    part_image = extra_large_state['parts'][part_index]
    
    edit_state['current_sheet'] = part_image.copy()
    edit_state['selected_cells'] = []
    edit_state['history'] = [part_image.copy()]
    edit_state['grid_size'] = 29
    edit_state['range_select_mode'] = False
    edit_state['range_points'] = []
    
    display_img = cv2.cvtColor(part_image, cv2.COLOR_BGR2RGB)
    
    return display_img, f"✅ {part_number}/4 パーツの編集モード開始\n💡 画像をクリックしてセルを選択できます", "選択中: 0個のセル"

def confirm_edit_extra_large_part(part_number):
    if edit_state['current_sheet'] is None:
        return None, None, "先に編集モードを開始してください"
    
    part_index = part_number - 1
    
    if not (0 <= part_index < len(extra_large_state['parts'])):
        return None, None, "⚠ パーツ番号が無効です"
    
    extra_large_state['parts'][part_index] = edit_state['current_sheet'].copy()
    
    display_part = cv2.cvtColor(edit_state['current_sheet'], cv2.COLOR_BGR2RGB)
    
    if extra_large_state['full_sheet'] is not None:
        display_full = cv2.cvtColor(extra_large_state['full_sheet'], cv2.COLOR_BGR2RGB)
    else:
        display_full = None
    
    return display_part, display_full, f"✅ {part_number}/4 パーツの編集を確定しました"

# ナビゲーションUI関数
def start_navigation():
    if current_state['bead_sheet'] is None:
        return None, "先にビーズシートを作成してください", ""
    
    color_counts = app._count_bead_colors(current_state['bead_sheet'])
    
    if not color_counts:
        return None, "⚠ ビーズが見つかりませんでした", ""
    
    navigation_list = sorted(color_counts.items(), key=lambda x: -x[1])
    current_state['navigation_list'] = navigation_list
    current_state['navigation_index'] = 0
    
    color_name, count = navigation_list[0]
    nav_img = app.create_navigation_image(current_state['bead_sheet'], color_name)
    
    display_img = cv2.cvtColor(nav_img, cv2.COLOR_BGR2RGB)
    
    progress = f"1/{len(navigation_list)}"
    info = f"🎨 {color_name}: {count}個"
    
    return display_img, info, progress

def next_navigation():
    if current_state['navigation_list'] is None:
        return None, "先にナビゲーションを開始してください", ""
    
    current_state['navigation_index'] += 1
    
    if current_state['navigation_index'] >= len(current_state['navigation_list']):
        display_img = cv2.cvtColor(current_state['bead_sheet'], cv2.COLOR_BGR2RGB)
        return display_img, "🎉 完成しました!アイロンをかけましょう! 🎉", "完了"
    
    color_name, count = current_state['navigation_list'][current_state['navigation_index']]
    nav_img = app.create_navigation_image(current_state['bead_sheet'], color_name)
    
    display_img = cv2.cvtColor(nav_img, cv2.COLOR_BGR2RGB)
    
    current = current_state['navigation_index'] + 1
    total = len(current_state['navigation_list'])
    progress = f"{current}/{total}"
    info = f"🎨 {color_name}: {count}個"
    
    return display_img, info, progress

def start_extra_large_navigation(part_number):
    if not extra_large_state['parts']:
        return None, "先に特大シートを作成してください", ""
    
    part_index = part_number - 1
    
    if not (0 <= part_index < len(extra_large_state['parts'])):
        return None, "⚠ パーツ番号が無効です", ""
    
    extra_large_state['current_part_index'] = part_index
    part_image = extra_large_state['parts'][part_index]
    
    color_counts = app.count_bead_colors_extra_large(part_image, part_index=part_index)
    
    if not color_counts:
        return None, f"⚠ {part_number}/4 パーツにビーズが見つかりませんでした", ""
    
    navigation_list = sorted(color_counts.items(), key=lambda x: -x[1])
    current_state['navigation_list'] = navigation_list
    current_state['navigation_index'] = 0
    
    color_name, count = navigation_list[0]
    nav_img = app.create_navigation_image_extra_large(part_image, color_name, grid_size=29)
    
    display_img = cv2.cvtColor(nav_img, cv2.COLOR_BGR2RGB)
    
    progress = f"{part_number}/4 パーツ - 1/{len(navigation_list)}"
    info = f"🎨 {color_name}: {count}個"
    
    return display_img, info, progress

def next_extra_large_navigation(part_number):
    if current_state['navigation_list'] is None:
        return None, "先にナビゲーションを開始してください", ""
    
    part_index = part_number - 1
    
    current_state['navigation_index'] += 1
    
    if current_state['navigation_index'] >= len(current_state['navigation_list']):
        part_image = extra_large_state['parts'][part_index]
        display_img = cv2.cvtColor(part_image, cv2.COLOR_BGR2RGB)
        return display_img, f"🎉 {part_number}/4 パーツ完成!", f"{part_number}/4 完了"
    
    color_name, count = current_state['navigation_list'][current_state['navigation_index']]
    
    part_image = extra_large_state['parts'][part_index]
    nav_img = app.create_navigation_image_extra_large(part_image, color_name, grid_size=29)
    
    display_img = cv2.cvtColor(nav_img, cv2.COLOR_BGR2RGB)
    
    current = current_state['navigation_index'] + 1
    total = len(current_state['navigation_list'])
    progress = f"{part_number}/4 パーツ - {current}/{total}"
    info = f"🎨 {color_name}: {count}個"
    
    return display_img, info, progress

def get_part_number(part_str):
    return int(part_str.split('/')[0])

#Part4
# ============================================
# Gradio UI構築
# ============================================

with gr.Blocks(title="デジタル・アイロンビーズ", theme=gr.themes.Soft()) as demo:
    gr.HTML("""
    <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: red; margin-bottom: 5px; font-size: 2.5em;">🎨 デジタル・アイロンビーズ</h1>
        <h3 style="margin-top: 5px; margin-bottom: 10px; color: #555;">〜アイロンビーズ制作支援Webアプリ〜</h3>
        <p style="margin-top: 5px; color: #666; font-size: 0.9em;">Copyright 2025 日本海情報ビジネス専門学校(ＮｉＢ)</p>
    </div>
    """)
    
    with gr.Tab("📷 1. 画像入力"):
        gr.Markdown("### 画像をアップロードするか、文字から画像を作成してください")
        
        with gr.Row():
            with gr.Column():
                gr.Markdown("**方法1: 画像をアップロード**")
                input_image = gr.Image(type="pil", label="画像をアップロード")
                upload_btn = gr.Button("画像を処理", variant="primary")
                
                gr.Markdown("**範囲を切り出す(オプション)**")
                gr.Markdown("💡 処理済み画像の左上と右下を2回クリックして範囲指定")
            
            with gr.Column():
                gr.Markdown("**方法2: 文字から画像を作成**")
                text_input = gr.Textbox(label="文字入力(全角2文字/半角4文字まで)", placeholder="例: kiyo")
                with gr.Row():
                    text_color = gr.Dropdown(
                        choices=list(app.color_palette.keys()),
                        value="くろ",
                        label="文字色"
                    )
                    bg_color = gr.Dropdown(
                        choices=list(app.color_palette.keys()),
                        value="しろ",
                        label="背景色"
                    )
                text_btn = gr.Button("文字から画像作成", variant="primary")
        
        output_image1 = gr.Image(label="処理済み画像", height=930)
        status1 = gr.Textbox(label="状態", interactive=False)
        
        with gr.Row():
            save_img1_btn = gr.Button("💾 画像を保存", variant="secondary")
            save_file1 = gr.File(label="保存ファイル")
        
        upload_btn.click(
            fn=process_uploaded_image,
            inputs=[input_image],
            outputs=[output_image1, status1]
        )
        
        output_image1.select(
            fn=handle_crop_click,
            outputs=[output_image1, status1]
        )
        
        text_btn.click(
            fn=create_text_image,
            inputs=[text_input, text_color, bg_color],
            outputs=[output_image1, status1]
        )
        
        save_img1_btn.click(
            fn=save_processed_image,
            outputs=[save_file1, status1]
        )
    
    with gr.Tab("🎨 2. ビーズシート作成"):
        gr.Markdown("### シートサイズと色数を選択してビーズシートを作成")
        
        with gr.Row():
            sheet_size = gr.Dropdown(
                choices=["大 (29セル)", "中 (21セル)", "小 (13セル)"],
                value="大 (29セル)",
                label="シートサイズ"
            )
            color_mode = gr.Dropdown(
                choices=["元の色", "2色", "16色(基本)", "32色(基本+拡張)"],
                value="元の色",
                label="色数"
            )
        
        with gr.Row():
            color1 = gr.Dropdown(
                choices=list(app.color_palette.keys()),
                value="くろ",
                label="色1(暗い部分)"
            )
            color2 = gr.Dropdown(
                choices=list(app.color_palette.keys()),
                value="きいろ",
                label="色2(明るい部分)"
            )
            threshold = gr.Slider(
                minimum=0,
                maximum=100,
                value=77,
                step=1,
                label="色1の優先度(%)"
            )
        
        create_sheet_btn = gr.Button("ビーズシート作成", variant="primary", size="lg")
        
        output_image2 = gr.Image(label="ビーズシート", height=930)
        status2 = gr.Textbox(label="状態", interactive=False)
        
        with gr.Row():
            save_sheet_btn = gr.Button("💾 ビーズシートを保存", variant="secondary")
            save_file2 = gr.File(label="保存ファイル")
        
        create_sheet_btn.click(
            fn=create_bead_sheet_ui,
            inputs=[sheet_size, color_mode, color1, color2, threshold],
            outputs=[output_image2, status2]
        )
        
        save_sheet_btn.click(
            fn=save_bead_sheet,
            outputs=[save_file2, status2]
        )
    
    with gr.Tab("✏️ 3. 編集モード(通常シート)"):
        gr.Markdown("### ビーズシートを編集(セルの色変更・削除)")
        gr.Markdown("💡 **画像をクリック**してセルを選択できます!")
        
        with gr.Row():
            start_edit_btn = gr.Button("編集モード開始", variant="primary")
            range_mode_btn = gr.Button("📐 範囲選択モード", variant="secondary")
            clear_sel_btn = gr.Button("選択クリア", variant="secondary")
        
        gr.Markdown("""
        **使い方:**
        - **単一セル**: 画像のセルをクリック(選択/解除切替)
        - **範囲選択**: 「範囲選択モード」→ 左上クリック → 右下クリック
        """)
        
        gr.Markdown("#### 編集操作")
        with gr.Row():
            edit_color = gr.Dropdown(
                choices=list(app.color_palette.keys()),
                value="あか",
                label="変更する色"
            )
            change_color_btn = gr.Button("色を変更", variant="primary")
            delete_btn = gr.Button("削除", variant="stop")
        
        with gr.Row():
            undo_btn = gr.Button("⪻ 1つ戻る", variant="secondary")
            confirm_edit_btn = gr.Button("✅ 編集確定", variant="primary", size="lg")
            cancel_edit_btn = gr.Button("❌ キャンセル", variant="stop")
        
        edit_output = gr.Image(label="編集中のシート", height=930)
        edit_status = gr.Textbox(label="状態", interactive=False)
        edit_info = gr.Textbox(label="選択情報", interactive=False)
        
        with gr.Row():
            save_edit_btn = gr.Button("💾 編集シートを保存", variant="secondary")
            save_file3 = gr.File(label="保存ファイル")
        
        start_edit_btn.click(
            fn=start_edit_mode,
            outputs=[edit_output, edit_status, edit_info]
        )
        
        range_mode_btn.click(
            fn=start_range_select_mode,
            outputs=[edit_output, edit_status, edit_info]
        )
        
        edit_output.select(
            fn=handle_canvas_click,
            outputs=[edit_output, edit_status, edit_info]
        )
        
        clear_sel_btn.click(
            fn=clear_selection,
            outputs=[edit_output, edit_status, edit_info]
        )
        
        change_color_btn.click(
            fn=change_cells_color,
            inputs=[edit_color],
            outputs=[edit_output, edit_status, edit_info]
        )
        
        delete_btn.click(
            fn=delete_cells,
            outputs=[edit_output, edit_status, edit_info]
        )
        
        undo_btn.click(
            fn=undo_edit,
            outputs=[edit_output, edit_status, edit_info]
        )
        
        confirm_edit_btn.click(
            fn=confirm_edit,
            outputs=[edit_output, edit_status]
        )
        
        cancel_edit_btn.click(
            fn=cancel_edit,
            outputs=[edit_output, edit_status]
        )
        
        save_edit_btn.click(
            fn=save_edited_sheet,
            outputs=[save_file3, edit_status]
        )
    
    with gr.Tab("📷 4. 特大シート (58セル)"):
        gr.Markdown("### 特大ビーズシート(58×58セル)を4分割で作成")
        
        with gr.Row():
            xl_color_mode = gr.Dropdown(
                choices=["元の色", "2色", "16色(基本)", "32色(基本+拡張)"],
                value="元の色",
                label="色数"
            )
        
        with gr.Row():
            xl_color1 = gr.Dropdown(
                choices=list(app.color_palette.keys()),
                value="くろ",
                label="色1(暗い部分)"
            )
            xl_color2 = gr.Dropdown(
                choices=list(app.color_palette.keys()),
                value="きいろ",
                label="色2(明るい部分)"
            )
            xl_threshold = gr.Slider(
                minimum=0,
                maximum=100,
                value=77,
                step=1,
                label="色1の優先度(%)"
            )
        
        create_xl_btn = gr.Button("特大シート作成", variant="primary", size="lg")
        
        with gr.Row():
            xl_full_output = gr.Image(label="全体シート (58×58)", height=930)
            xl_part_output = gr.Image(label="パーツ表示 (29×29)", height=930)
        
        xl_status = gr.Textbox(label="状態", interactive=False)
        
        gr.Markdown("#### パーツ切り替え")
        with gr.Row():
            part_btn_1 = gr.Button("1/4 (左上)", variant="secondary")
            part_btn_2 = gr.Button("2/4 (右上)", variant="secondary")
            part_btn_3 = gr.Button("3/4 (左下)", variant="secondary")
            part_btn_4 = gr.Button("4/4 (右下)", variant="secondary")
        
        part_switch_status = gr.Textbox(label="パーツ状態", interactive=False)
        
        create_xl_btn.click(
            fn=create_extra_large_sheet_ui,
            inputs=[xl_color_mode, xl_color1, xl_color2, xl_threshold],
            outputs=[xl_full_output, xl_part_output, xl_status]
        )
        
        part_btn_1.click(
            fn=lambda: switch_extra_large_part(1),
            outputs=[xl_part_output, part_switch_status]
        )
        
        part_btn_2.click(
            fn=lambda: switch_extra_large_part(2),
            outputs=[xl_part_output, part_switch_status]
        )
        
        part_btn_3.click(
            fn=lambda: switch_extra_large_part(3),
            outputs=[xl_part_output, part_switch_status]
        )
        
        part_btn_4.click(
            fn=lambda: switch_extra_large_part(4),
            outputs=[xl_part_output, part_switch_status]
        )
    
    with gr.Tab("✏️ 5. 特大シート編集"):
        gr.Markdown("### 特大シートのパーツを編集")
        gr.Markdown("💡 **画像をクリック**してセルを選択できます!")
        
        with gr.Row():
            edit_part_select = gr.Radio(
                choices=["1/4", "2/4", "3/4", "4/4"],
                value="1/4",
                label="編集するパーツを選択"
            )
        
        with gr.Row():
            start_xl_edit_btn = gr.Button("パーツ編集開始", variant="primary")
            xl_range_mode_btn = gr.Button("📐 範囲選択モード", variant="secondary")
            xl_clear_sel_btn = gr.Button("選択クリア", variant="secondary")
        
        gr.Markdown("""
        **使い方:**
        - **単一セル**: 画像のセルをクリック(選択/解除切替)
        - **範囲選択**: 「範囲選択モード」→ 左上クリック → 右下クリック
        """)
        
        gr.Markdown("#### 編集操作")
        with gr.Row():
            xl_edit_color = gr.Dropdown(
                choices=list(app.color_palette.keys()),
                value="あか",
                label="変更する色"
            )
            xl_change_color_btn = gr.Button("色を変更", variant="primary")
            xl_delete_btn = gr.Button("削除", variant="stop")
        
        with gr.Row():
            xl_undo_btn = gr.Button("⪻ 1つ戻る", variant="secondary")
            xl_confirm_edit_btn = gr.Button("✅ 編集確定", variant="primary", size="lg")
            xl_cancel_edit_btn = gr.Button("❌ キャンセル", variant="stop")
        
        xl_edit_output = gr.Image(label="編集中のパーツ", height=930)
        xl_edit_status = gr.Textbox(label="状態", interactive=False)
        xl_edit_info = gr.Textbox(label="選択情報", interactive=False)
        
        start_xl_edit_btn.click(
            fn=lambda p: start_edit_extra_large_part(get_part_number(p)),
            inputs=[edit_part_select],
            outputs=[xl_edit_output, xl_edit_status, xl_edit_info]
        )
        
        xl_range_mode_btn.click(
            fn=start_range_select_mode,
            outputs=[xl_edit_output, xl_edit_status, xl_edit_info]
        )
        
        xl_edit_output.select(
            fn=handle_canvas_click,
            outputs=[xl_edit_output, xl_edit_status, xl_edit_info]
        )
        
        xl_clear_sel_btn.click(
            fn=clear_selection,
            outputs=[xl_edit_output, xl_edit_status, xl_edit_info]
        )
        
        xl_change_color_btn.click(
            fn=change_cells_color,
            inputs=[xl_edit_color],
            outputs=[xl_edit_output, xl_edit_status, xl_edit_info]
        )
        
        xl_delete_btn.click(
            fn=delete_cells,
            outputs=[xl_edit_output, xl_edit_status, xl_edit_info]
        )
        
        xl_undo_btn.click(
            fn=undo_edit,
            outputs=[xl_edit_output, xl_edit_status, xl_edit_info]
        )
        
        xl_confirm_edit_btn.click(
            fn=lambda p: confirm_edit_extra_large_part(get_part_number(p)),
            inputs=[edit_part_select],
            outputs=[xl_edit_output, xl_full_output, xl_edit_status]
        )
        
        xl_cancel_edit_btn.click(
            fn=cancel_edit,
            outputs=[xl_edit_output, xl_edit_status]
        )
    
    with gr.Tab("🧭 6. ナビゲーション"):
        gr.Markdown("### 色ごとに表示して制作をナビゲート")
        
        gr.Markdown("#### 通常シート用ナビゲーション")
        with gr.Row():
            start_nav_btn = gr.Button("ナビゲーション開始", variant="primary")
            next_btn = gr.Button("次へ ➡️", variant="secondary")
        
        nav_progress = gr.Textbox(label="進捗", interactive=False)
        nav_info = gr.Textbox(label="現在の色", interactive=False)
        output_image3 = gr.Image(label="ナビゲーション表示", height=930)
        
        start_nav_btn.click(
            fn=start_navigation,
            outputs=[output_image3, nav_info, nav_progress]
        )
        
        next_btn.click(
            fn=next_navigation,
            outputs=[output_image3, nav_info, nav_progress]
        )
        
        gr.Markdown("---")
        gr.Markdown("#### 特大シート用ナビゲーション")
        
        with gr.Row():
            xl_nav_part_select = gr.Radio(
                choices=["1/4", "2/4", "3/4", "4/4"],
                value="1/4",
                label="ナビゲーションするパーツを選択"
            )
        
        with gr.Row():
            start_xl_nav_btn = gr.Button("特大ナビゲーション開始", variant="primary")
            next_xl_btn = gr.Button("次へ ➡️", variant="secondary")
        
        xl_nav_progress = gr.Textbox(label="進捗", interactive=False)
        xl_nav_info = gr.Textbox(label="現在の色", interactive=False)
        xl_nav_output = gr.Image(label="ナビゲーション表示", height=930)
        
        start_xl_nav_btn.click(
            fn=lambda p: start_extra_large_navigation(get_part_number(p)),
            inputs=[xl_nav_part_select],
            outputs=[xl_nav_output, xl_nav_info, xl_nav_progress]
        )
        
        next_xl_btn.click(
            fn=lambda p: next_extra_large_navigation(get_part_number(p)),
            inputs=[xl_nav_part_select],
            outputs=[xl_nav_output, xl_nav_info, xl_nav_progress]
        )
    
    with gr.Tab("ℹ️ 使い方"):
        gr.Markdown("""
        ## 📖 使い方(完全修正版)
        
        ### 1️⃣ 画像入力
        - **画像アップロード**: お好きな画像をアップロードして「画像を処理」をクリック
        - **範囲を切り出す**: 処理済み画像の**左上と右下を2回クリック**して範囲を指定
        - **文字から作成**: 文字を入力して色を選び「文字から画像作成」をクリック
        - **💾 保存**: 「画像を保存」ボタンでダウンロード
        
        ### 2️⃣ ビーズシート作成
        - **シートサイズ**: 大(29×29)、中(21×21)、小(13×13)から選択
        - **色数**: 元の色、2色、16色、32色から選択
        - **💾 保存**: 「ビーズシートを保存」ボタンでダウンロード
        
        ### 3️⃣ 編集モード(通常シート)
        - **画像クリックでセル選択**: 
          - **単一セル**: 画像のセルを直接クリックして選択/解除
          - **範囲選択**: 「範囲選択モード」→ 左上セルクリック → 右下セルクリック
        - **色変更**: セルを選択して色を変更
        - **削除**: セルを選択して削除
        - **💾 保存**: 「編集シートを保存」ボタンでダウンロード
        
        ### 4️⃣ 特大シート(58×58セル)
        - 大きなデザイン用に58×58セルのシートを作成
        - 4つのパーツ(29×29)に分割表示
        
        ### 5️⃣ 特大シート編集
        - 各パーツ(1/4〜4/4)を個別に編集可能
        
        ### 6️⃣ ナビゲーション
        - 「ナビゲーション開始」で色ごとの表示を開始
        - 「次へ」で次の色に進む
              
        ### 💾 保存機能について
        - **保存先**: ブラウザのダウンロードフォルダ
        - **iPad**: Safariの「ダウンロード」→「ファイル」アプリで確認 
        - **ファイル名**: 自動的に日付時刻付きで生成
        """)
    
    gr.Markdown("---")
    reset_btn = gr.Button("🔄 すべてリセット")
    reset_status = gr.Textbox(label="", interactive=False)
    
    reset_btn.click(
        fn=reset_all,
        outputs=[output_image1, output_image2, reset_status]
    )

# ============================================
# アプリ起動
# ============================================

print("🚀 デジタル・アイロンビーズ～アイロンビーズ制作支援Webアプリ～を起動しています...")
print(f"📐 キャンバスサイズ: {app.disp_w}×{app.disp_h}px")
demo.launch(share=True, debug=True)