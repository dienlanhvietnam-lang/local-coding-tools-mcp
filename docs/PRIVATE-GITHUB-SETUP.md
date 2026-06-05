# Private GitHub Setup — local-coding-tools-mcp

Hướng dẫn đưa repo lên **GitHub private**. Agent/script **không** tự tạo repo, **không** lưu token, **không** push nếu chưa có quyền người dùng.

## 1. Tạo repository trên GitHub

1. Đăng nhập GitHub → **New repository**
2. Name: `local-coding-tools-mcp`
3. Visibility: **Private**
4. **Không** thêm README / .gitignore / license (đã có local)
5. Create repository

## 2. Thêm remote (local)

Thay `<owner>` bằng user hoặc org của bạn:

```powershell
cd E:\MCP\local-coding-tools-mcp
git branch -M main
git remote add origin https://github.com/<owner>/local-coding-tools-mcp.git
git remote -v
```

Nếu `origin` đã tồn tại:

```powershell
git remote set-url origin https://github.com/<owner>/local-coding-tools-mcp.git
```

## 3. Push (người dùng tự chạy)

**Không paste token vào chat, log, hoặc commit.**

Dùng GitHub CLI, credential manager, hoặc SSH:

```powershell
# HTTPS (credential manager / PAT khi được hỏi — không lưu vào repo)
git push -u origin main
git push origin --tags
```

SSH alternative:

```powershell
git remote set-url origin git@github.com:<owner>/local-coding-tools-mcp.git
git push -u origin main
git push origin --tags
```

## 4. Kiểm tra sau push

- [ ] Repo visibility = **Private**
- [ ] Branch `main` có baseline commit
- [ ] Tag `phase-1.3-full-image-installer-pass` (nếu đã tạo local)
- [ ] Không có `node_modules/`, `.env`, `release/*.zip` trên GitHub
- [ ] Actions: workflow `.github/workflows/ci.yml` (nếu bật Actions)

## 5. Branch protection (khuyến nghị)

Settings → Branches → Add rule for `main`:

- Require PR before merge (optional for solo)
- Require status checks: CI workflow PASS
- No force push to `main`

## 6. Secrets trên GitHub

- **Không** thêm `REPLICATE_API_TOKEN`, `REMOVE_BG_API_KEY` vào repo
- CI hiện **không** yêu cầu full-image secrets
- Nếu sau này cần secret: dùng **GitHub Actions Secrets** (Settings → Secrets), không commit file

## 7. Phân phối customer ZIP

ZIP **không** nằm trong Git. Cách phân phối:

1. GitHub Actions artifact (sau CI PASS), hoặc
2. Chia sẻ file `release/local-coding-tools-mcp-v0.7.0-customer.zip` + `SHA256SUMS.txt` ngoài Git

Luôn verify checksum trước khi cài:

```powershell
# So sánh với release/SHA256SUMS.txt
Get-FileHash release\local-coding-tools-mcp-v0.7.0-customer.zip -Algorithm SHA256
```
