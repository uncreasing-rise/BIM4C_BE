ALTER TABLE "projects"
ADD COLUMN "investor" VARCHAR(1000),
ADD COLUMN "expected_completion" VARCHAR(180),
ADD COLUMN "scale" VARCHAR(2000),
ADD COLUMN "contract_package" VARCHAR(500);

UPDATE "projects"
SET
  "investor" = 'Đơn vị Đầu Tư & Phát Triển liên doanh Nhật Bản Cosmos Initia - TT Capital – Koterasu Partner',
  "expected_completion" = 'N/a',
  "scale" = 'Diện tích khu đất: 1,6 ha gồm 2 tháp với 2 hầm chung, Tháp A: 30 tầng, Tháp B: 37 tầng',
  "contract_package" = 'Tổng thầu thi công',
  "location" = 'Đường DT743A, P. Tân Đông Hiệp, TP. Dĩ An, tỉnh Bình Dương'
WHERE "slug" = 'tt-avio';
