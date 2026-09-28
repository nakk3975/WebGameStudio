package studio.webgame.ghostdesk;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CatalogMapper {
    record Entry(String caseId, String versionId, String title, String description, int estimatedMinutes) {}

    @Select("""
        SELECT DISTINCT ON (case_id) case_id AS "caseId", version_id AS "versionId",
               package->>'title' AS title, package->>'description' AS description,
               (package->>'estimatedMinutes')::integer AS "estimatedMinutes"
        FROM ghostdesk.case_versions WHERE published = true
        ORDER BY case_id, published_at DESC, version_id DESC LIMIT 50
        """)
    List<Entry> catalog();

    @Select("""
        SELECT package::text FROM ghostdesk.case_versions
        WHERE version_id = #{versionId} AND published = true
        """)
    String packageJson(@Param("versionId") String versionId);

    @Select("SELECT count(DISTINCT case_id) FROM ghostdesk.case_versions WHERE published = true")
    int publishedCount();
}
