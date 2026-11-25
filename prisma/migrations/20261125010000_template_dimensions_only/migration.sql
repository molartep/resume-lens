-- Templates now hold dimensions only. Existing execution snapshots and queue payloads remain untouched.
UPDATE "ScreeningTemplate"
SET "configuration" = json_remove("configuration", '$.model', '$.timezone'),
    "configurationSchemaVersion" = 2,
    "revision" = "revision" + 1,
    "updatedAt" = CAST(strftime('%s', 'now') AS INTEGER) * 1000,
    "description" = CASE
      WHEN "description" = ('Example starting point. Customize the criteria to your specific job requirements' || char(59) || ' interpret evidence through human review.') THEN
        CASE "nameKey"
          WHEN 'general candidate screening' THEN 'Review relevant professional experience, demonstrated skills, responsibilities and accomplishments against your role requirements.'
          WHEN 'software engineer' THEN 'Review programming experience, engineering practices, system design, technical depth and ownership of production software.'
          WHEN 'data engineer' THEN 'Review Python and SQL, data pipelines, modeling and storage, quality and governance, distributed processing and production ownership.'
          ELSE "description"
        END
      ELSE "description"
    END
WHERE "configurationSchemaVersion" = 1;
