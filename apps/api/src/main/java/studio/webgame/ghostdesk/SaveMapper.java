package studio.webgame.ghostdesk;

import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface SaveMapper {
    record Row(String caseId, String versionId, String payload, long revision, String updatedAt) {}
    @Select("SELECT set_config('app.user_id', #{userId}, true)")
    String scope(String userId);
    @Select("""
      SELECT case_id AS "caseId", version_id AS "versionId", payload::text AS payload,
             revision, updated_at::text AS "updatedAt"
      FROM ghostdesk.user_saves WHERE user_id=#{userId} ORDER BY case_id LIMIT 50
      """)
    List<Row> list(String userId);
    @Select("""
      SELECT case_id AS "caseId", version_id AS "versionId", payload::text AS payload,
             revision, updated_at::text AS "updatedAt"
      FROM ghostdesk.user_saves WHERE user_id=#{userId} AND case_id=#{caseId}
      """)
    Row get(@Param("userId") String userId, @Param("caseId") String caseId);
    @Insert("""
      INSERT INTO ghostdesk.user_saves(user_id,case_id,version_id,payload,revision)
      VALUES(#{userId},#{caseId},#{versionId},CAST(#{payload} AS jsonb),1)
      ON CONFLICT (user_id,case_id) DO NOTHING
      """)
    int insert(@Param("userId") String userId,@Param("caseId") String caseId,
      @Param("versionId") String versionId,@Param("payload") String payload);
    @Update("""
      UPDATE ghostdesk.user_saves SET payload=CAST(#{payload} AS jsonb),version_id=#{versionId},
        revision=revision+1,updated_at=now()
      WHERE user_id=#{userId} AND case_id=#{caseId} AND revision=#{revision}
      """)
    int update(@Param("userId") String userId,@Param("caseId") String caseId,
      @Param("versionId") String versionId,@Param("payload") String payload,@Param("revision") long revision);
}
