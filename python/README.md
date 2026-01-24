# Python Scripts

Scripts Python để test và kiểm tra format lời giải toán học.

## Cài đặt

Không cần cài đặt thêm thư viện, script sử dụng thư viện chuẩn của Python.

## Cách chạy

### 1. Test format lời giải

```bash
cd python
python3 test_format.py
```

Hoặc:

```bash
python3 python/test_format.py
```

### 2. Xem ví dụ JSON format

```bash
python3 test_format.py --json
```

## Mô tả

Script `test_format.py` sẽ:
- ✅ Kiểm tra format của lời giải có đúng không
- ✅ Phát hiện các lỗi format (dòng tiêu đề thừa, nhiều dấu bằng trên một dòng)
- ✅ Cảnh báo các vấn đề tiềm ẩn (dòng chỉ có giải thích riêng)
- ✅ Hiển thị ví dụ JSON đúng format

## Yêu cầu format

1. **Mỗi dòng một bước**: Mỗi phép biến đổi phải ở trên một dòng riêng
2. **Giải thích trong ngoặc**: Giải thích đặt ngay sau phần toán học, trong dấu ngoặc đơn
3. **Không có dòng tiêu đề**: Không được có dòng như "Phân tích đa thức thành nhân tử:" hay "Giải phương trình:"
4. **Mỗi dấu bằng một dòng**: Không được viết nhiều dấu bằng trên cùng một dòng

## Ví dụ đúng format

```
$x^2 - 5x + 6$
$x^2 - 5x + 6 = x^2 - 2x - 3x + 6$ (tách hạng tử $-5x$ thành $-2x - 3x$)
$x^2 - 5x + 6 = (x^2 - 2x) - (3x - 6)$ (nhóm các hạng tử phù hợp)
$x^2 - 5x + 6 = x(x - 2) - 3(x - 2)$ (rút các nhân tử chung)
$x^2 - 5x + 6 = (x - 2)(x - 3)$ (rút $x-2$ làm nhân tử chung)
```

## Ví dụ sai format

❌ **Sai**: Có dòng tiêu đề
```
Phân tích đa thức thành nhân tử:
$x^2 - 5x + 6 = ...$
```

❌ **Sai**: Nhiều dấu bằng trên một dòng
```
$x^2 - 5x + 6 = x^2 - 2x - 3x + 6 = (x^2 - 2x) - (3x - 6)$
```

❌ **Sai**: Dòng chỉ có giải thích riêng
```
$x^2 - 5x + 6$
(Tìm hai số có tổng bằng $-5$ và tích bằng $6$)
$x^2 - 5x + 6 = ...$
```
